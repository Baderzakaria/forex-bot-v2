import crypto from 'crypto';

function normalizeTitle(title) {
  return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function countryCodeFromZone(zone) {
  const z = String(zone || '').toLowerCase();
  if (z.includes('united states') || z === 'us' || z.includes('usa')) return 'US';
  if (z.includes('united kingdom') || z === 'gb' || z.includes('uk')) return 'GB';
  if (z.includes('germany') || z === 'de') return 'DE';
  if (z.includes('japan') || z === 'jp') return 'JP';
  if (z.includes('switzerland') || z === 'ch') return 'CH';
  if (z.includes('canada') || z === 'ca') return 'CA';
  if (z.includes('australia') || z === 'au') return 'AU';
  if (z.includes('new zealand') || z === 'nz') return 'NZ';
  if (z.includes('euro') || z.includes('euro zone') || z.includes('europe') || z === 'eu') return 'EU';
  return String(z.slice(0, 2) || 'XX').toUpperCase();
}

function parseDateParts(dateText) {
  const text = String(dateText || '').trim();
  if (!text) return null;

  const ddmmyyyy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    return {
      year: Number(ddmmyyyy[3]),
      month: Number(ddmmyyyy[2]),
      day: Number(ddmmyyyy[1]),
    };
  }

  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return {
      year: Number(ymd[1]),
      month: Number(ymd[2]),
      day: Number(ymd[3]),
    };
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

function parseTimeParts(timeText) {
  const text = String(timeText || '').trim();
  const m = text.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { hour: 0, minute: 0 };
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function parseEventTimeUtc(event, tzOffsetHours = 1) {
  const rawIso =
    event.event_time_utc ||
    event.eventTimeUtc ||
    event.datetime ||
    event.dateTime ||
    event.utc_time ||
    event.utcTime;

  if (rawIso) {
    const parsed = new Date(rawIso);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const dateText = event.date || event.event_date || event.day || '';
  const timeText = event.time || event.event_time || event.hour || '00:00';
  const parts = parseDateParts(dateText);
  if (!parts) return new Date().toISOString();

  const { hour, minute } = parseTimeParts(timeText);
  const localMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0);
  return new Date(localMs - tzOffsetHours * 3600000).toISOString();
}

export function buildEventKey(event, source = 'apify-calendar') {
  const eventId = event.id || event.event_id || event.eventId || event.apify_id;
  if (eventId !== undefined && eventId !== null && String(eventId).trim() !== '') {
    const payload = `${source}|id|${eventId}`;
    return {
      event_key: crypto.createHash('sha256').update(payload).digest('hex'),
      payload,
      event_time_utc: parseEventTimeUtc(event),
    };
  }

  const payload = [
    source,
    countryCodeFromZone(event.zone || event.country || event.country_code),
    String(event.currency || '').trim().toUpperCase(),
    normalizeTitle(event.event || event.title || event.name),
    parseEventTimeUtc(event),
    String(event.importance || 'high').trim().toLowerCase(),
  ].join('|');

  return {
    event_key: crypto.createHash('sha256').update(payload).digest('hex'),
    payload,
    event_time_utc: parseEventTimeUtc(event),
  };
}

export function formatHighImpactEvent(ev, { preAlertMinutes = 30 } = {}) {
  const country = String(ev.country_code || ev.country || 'US').trim().toUpperCase();
  const title = String(ev.title || ev.event || 'Event').trim();
  const timeUtc = ev.event_time_utc
    ? new Date(ev.event_time_utc).toISOString().slice(0, 19)
    : parseEventTimeUtc(ev).slice(0, 19);
  const forecast = ev.forecast ? String(ev.forecast) : '—';
  const previous = ev.previous ? String(ev.previous) : '—';
  const actual = ev.actual ? String(ev.actual) : null;

  const lines = [
    '🔥 HIGH IMPACT EVENT',
    '',
    `📍 Country: ${country}`,
    `📊 Event: ${title}`,
    `⏰ Event Time (UTC): ${timeUtc}`,
    '⚡ Impact: High Impact Expected',
  ];

  if (forecast !== '—' || previous !== '—') {
    lines.push('', `📈 Forecast: ${forecast} · Prior: ${previous}`);
  }

  if (actual) {
    lines.push(`✅ Actual: ${actual}`);
  }

  lines.push('', `📅 Scheduled to post ${preAlertMinutes} minutes before event`);
  return lines.join('\n');
}
