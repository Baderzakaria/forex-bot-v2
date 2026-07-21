import config from './config.js';
import db from './db.js';
import { enqueue } from './outbox.js';
import { syncAllFromDb, sheetUrl } from './sheets.js';

function toIso(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function utcDate(value) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : '';
}

function utcTime(value) {
  const iso = toIso(value);
  return iso ? iso.slice(11, 16) : '';
}

function addMinutes(isoValue, minutes) {
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - Number(minutes || 0) * 60_000).toISOString();
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function preview(value, max = 100) {
  const s = text(value).replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function groupByDay(events) {
  const map = new Map();
  for (const event of events) {
    const key = utcDate(event.event_time_utc);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
  }
  return map;
}

function addUtcDays(dateKey, deltaDays) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function buildMorningBriefText({ events = [], outbox = [], posts = [], sheetUrl: link = sheetUrl(), preAlertMinutes = config.preAlertMinutes } = {}) {
  const today = utcDate(new Date());
  const eventsByDay = groupByDay(events);
  const todayHighImpact = (eventsByDay.get(today) || []).filter((event) => String(event.importance || '').toLowerCase() === 'high');
  const upcomingDays = [1, 2, 3].map((offset) => addUtcDays(today, offset));

  const lines = [
    '🌅 Morning brief',
    '',
    `Today (${today}) high-impact events:`,
  ];

  if (!todayHighImpact.length) {
    lines.push('  (none)');
  } else {
    for (const event of todayHighImpact) {
      const alertAt = addMinutes(event.event_time_utc, preAlertMinutes);
      lines.push(`  • ${utcTime(event.event_time_utc)} UTC · ${event.currency} ${event.title}`);
      lines.push(`    alert ${utcTime(alertAt)} UTC · prior ${text(event.previous) || '—'} · forecast ${text(event.forecast) || '—'}`);
    }
  }

  lines.push('', 'Next 3 days:');
  if (!upcomingDays.length) {
    lines.push('  (none)');
  } else {
    for (const day of upcomingDays) {
      const dayEvents = (eventsByDay.get(day) || []).slice(0, 3);
      lines.push(`  • ${day}: ${eventsByDay.get(day)?.length || 0} events`);
      if (!dayEvents.length) {
        lines.push('    (none)');
      } else {
        for (const event of dayEvents) {
          lines.push(`    - ${utcTime(event.event_time_utc)} UTC · ${event.currency} ${event.title}`);
        }
      }
    }
  }

  lines.push('', 'Pending outbox:');
  if (!outbox.length) {
    lines.push('  (none)');
  } else {
    for (const row of outbox.slice(0, 12)) {
      lines.push(`  • ${utcDate(row.scheduled_at)} ${utcTime(row.scheduled_at)} UTC · ${row.destination_type} · ${row.status}`);
      lines.push(`    ${preview(row.content_text, 90)}`);
    }
  }

  lines.push('', 'Draft posts awaiting approval:');
  const draftRows = posts.filter((post) => String(post.status || '').toLowerCase() === 'drafted');
  if (!draftRows.length) {
    lines.push('  (none)');
  } else {
    for (const post of draftRows.slice(0, 12)) {
      lines.push(`  • ${utcDate(post.updated_at || post.created_at)} ${utcTime(post.updated_at || post.created_at)} UTC · ${post.kind || 'post'} · ${post.status}`);
      lines.push(`    ${preview(post.draft_text || post.request_text || '', 90)}`);
    }
  }

  if (link) {
    lines.push('', `📊 Legacy Sheets: ${link}`);
  }
  return lines.join('\n');
}

export async function sendMorningBrief({ days = 31, preAlertMinutes = config.preAlertMinutes } = {}) {
  const synced = await syncAllFromDb(db, { days });
  const briefText = buildMorningBriefText({
    events: synced.events,
    outbox: synced.outbox,
    posts: synced.posts,
    sheetUrl: synced.sheetUrl,
    preAlertMinutes,
  });

  if (!config.adminChatId) {
    return { ok: true, skipped: true, synced, text: briefText };
  }

  enqueue({
    dedupe_key: `morning-brief:${utcDate(new Date())}`,
    destination_type: 'telegram_admin',
    destination_id: String(config.adminChatId),
    content_text: briefText,
    created_by: 'morning-cron',
  });

  return { ok: true, synced, text: briefText };
}
