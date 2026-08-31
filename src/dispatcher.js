import db from './db.js';
import config from './config.js';
import { enqueue, getBoolSetting, setSetting } from './outbox.js';
import { createTokens, keyboard, resolveToken, processApprovalCallback, scheduleAutoPublish } from './approval.js';
import { answerCallbackQuery, editMessageReplyMarkup, sendMessage } from './telegram.js';
import { getDailySettings, generateDailyQuote, pickQuote, formatQuotePost, getFxRates } from './content.js';
import { discoverMacro, formatDiscoverSummary } from './apify.js';
import { sheetUrl, syncAllFromDb } from './sheets.js';

const COMMANDS = new Set(['/help', '/quotes', '/news', '/calendar', '/calendar_month', '/status', '/pending', '/settings', '/schedule', '/draft_daily', '/draft_macro', '/discover_calendar', '/pause_publishing', '/resume_publishing', '/hadith', '/plan_days', '/sync_sheet']);

function withSheetFooter(text) {
  const url = sheetUrl();
  return url ? `${text}\n\n📊 Legacy Sheets: ${url}` : text;
}

export async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const userId = msg.from?.id;
  const text = (msg.text || '').trim();
  const username = msg.from?.username || '';

  if (!text) return;
  if (config.allowedUserIds.length && !config.allowedUserIds.includes(String(userId))) return;

  if (text.startsWith('/')) {
    return handleCommand(text, chatId, userId, username);
  }

  // Plain text is ignored in v2. No chat AI.
}

export async function handleCallback(cb) {
  const data = cb.data || '';
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const userId = cb.from?.id;
  const username = cb.from?.username || '';

  await answerCallbackQuery(cb.id, '✓');

  if (data === 'qu:pending') {
    const text = await buildPendingText();
    await sendMessage(chatId, text);
    return;
  }

  const tokenRow = resolveToken(data);
  if (!tokenRow) {
    await sendMessage(chatId, '⚠️ Button expired or already used. /pending for queue.');
    return;
  }

  const result = processApprovalCallback(tokenRow, userId, username, chatId);
  if (result.ok && result.action === 'approve') {
    await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [[{ text: '✅ Approved', callback_data: 'noop' }]] });
  } else if (result.ok && result.action === 'reject') {
    await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] });
  }
}

async function handleCommand(text, chatId, userId, username) {
  const [cmd, ...args] = text.split(/\s+/);
  const lc = cmd.toLowerCase();

  if (COMMANDS.has(lc)) {
    switch (lc) {
      case '/help': return sendMessage(chatId, buildHelpText());
      case '/news':
        return sendMessage(chatId, 'News drafting is disabled in v2. Use /discover_calendar for macro events.');
      case '/draft_macro':
        return sendMessage(chatId, 'Macro drafting is disabled in v2. Use /discover_calendar.');
      case '/discover_calendar':
        return sendMessage(chatId, await handleDiscoverCalendar(args.join(' ')));
      case '/quotes': {
        const rates = await getFxRates().catch(() => null);
        const quote = pickQuote();
        return sendMessage(chatId, formatQuotePost(quote, rates));
      }
      case '/status': return sendMessage(chatId, await buildStatusText());
      case '/pending': return sendMessage(chatId, await buildPendingText());
      case '/schedule': return sendMessage(chatId, buildScheduleText());
      case '/settings': return sendMessage(chatId, handleSettings(args.join(' ')));
      case '/plan_days':
      case '/sync_sheet':
        return sendMessage(chatId, await handleSyncSheetCommand(args.join(' ')));
      case '/pause_publishing':
        setSetting('publishing_paused', 'true');
        return sendMessage(chatId, '⏸ Publishing paused.');
      case '/resume_publishing':
        setSetting('publishing_paused', 'false');
        return sendMessage(chatId, '▶️ Publishing resumed.');
      case '/hadith': return sendMessage(chatId, '📿 Hadith paused in v2. Macro calendar only.');
      case '/draft_daily':
        if (getDailySettings().dailyQuoteEnabled === false) {
          return sendMessage(chatId, '📝 Daily quote is disabled.');
        }
        await generateDailyQuote();
        return sendMessage(chatId, '📝 Daily quote drafted.');
      case '/calendar': return handleCalendarCommand(chatId, false);
      case '/calendar_month': return handleCalendarCommand(chatId, true);
    }
  }

  return sendMessage(chatId, `Unknown command: ${cmd}\nTry /help`);
}

function buildHelpText() {
  return [
    '📋 Forex Bot v2',
    '',
    'Info:',
    '  /quotes — FX rates + wisdom',
    '  /calendar — today\'s high-impact events',
    '  /calendar_month — full month',
    '  Calendar auto-refreshes if empty',
    '  /discover_calendar [month|force] — refresh macro calendar',
    '  Alerts: T-30 pre-alerts, T+0 release drafts, targeted Apify actual fetches, actual follow-ups',
    '  /plan_days [N] — sync legacy Sheets for N days',
    '  /sync_sheet [N] — rebuild legacy Sheets tabs',
    '  /status — pipeline health',
    '  /pending — drafts + outbox queue',
    '  /schedule — cron timetable',
    '  /help — this list',
    '',
    'Daily content:',
    '  /draft_daily — generate quote draft',
    '  /hadith — paused in v2',
    '',
    'Settings:',
    '  /settings — view toggles',
    '  /settings writing on|off',
    '  /settings quote on|off',
    '',
    'Publishing:',
    `  Auto: ${config.autoApprove && config.autoPublish ? `ON (${config.autoApproveGraceSeconds}s)` : 'OFF'}`,
    '  /pause_publishing · /resume_publishing',
    '',
    `Legacy Sheets: ${sheetUrl() || 'unavailable'}`,
    `Env: ${config.environment} | v2 single-process`,
  ].join('\n');
}

function buildScheduleText() {
  return [
    '🗓 Schedule (UTC)',
    '',
    '  07:00 — macro discover',
    '  07:15 — morning brief + optional legacy sheet sync',
    '  Every minute — T-30, T+0, targeted Apify actual fetches, and actual alert scan',
    '  07:30 — daily quote',
    '',
    `Auto-publish: ${config.autoApprove && config.autoPublish ? 'ON' : 'OFF'}`,
    `Grace: ${config.autoApproveGraceSeconds}s`,
  ].join('\n');
}

async function buildStatusText() {
  const pending = db.prepare(`SELECT COUNT(*) as c FROM outbox WHERE status IN ('pending','scheduled','failed')`).get();
  const posts = db.prepare(`SELECT status, COUNT(*) as c FROM posts GROUP BY status`).all();
  const events = db.prepare(`SELECT COUNT(*) as c FROM events WHERE event_time_utc >= datetime('now', '-1 day')`).get();
  const lastApify = db.prepare(`
    SELECT
      MAX(CASE WHEN key = 'apify_last_run_at' THEN value END) AS last_run_at,
      MAX(CASE WHEN key = 'apify_last_run_caller' THEN value END) AS last_run_caller,
      MAX(CASE WHEN key = 'apify_last_run_ok' THEN value END) AS last_run_ok,
      MAX(CASE WHEN key = 'apify_last_run_summary' THEN value END) AS last_run_summary
    FROM settings
    WHERE key IN ('apify_last_run_at', 'apify_last_run_caller', 'apify_last_run_ok', 'apify_last_run_summary')
  `).get();
  const postStr = posts.map(r => `${r.status}=${r.c}`).join(', ') || 'none';
  return withSheetFooter([
    '🩺 Forex Bot v2',
    `Env: ${config.environment}`,
    `Outbox pending: ${pending?.c || 0}`,
    `Posts: ${postStr}`,
    `Events (24h): ${events?.c || 0}`,
    `Alerts: T-30=${config.preAlertMinutes}m, T+0=${config.releaseAlertEnabled ? 'on' : 'off'}, actual=${config.actualAlertEnabled ? 'on' : 'off'}`,
    `Apify last run: ${lastApify?.last_run_caller || 'none'} @ ${lastApify?.last_run_at || 'n/a'} · ${lastApify?.last_run_ok === 'true' ? 'ok' : (lastApify?.last_run_ok === 'false' ? 'fail' : 'n/a')}`,
    `Apify summary: ${lastApify?.last_run_summary || 'n/a'}`,
    `Auto-publish: ${config.autoApprove && config.autoPublish ? 'ON' : 'OFF'}`,
    `Public chat: ${config.publicChatId || 'same as admin'}`,
  ].join('\n'));
}

async function buildPendingText() {
  const drafts = db.prepare(`
    SELECT post_id, version, status, kind, substr(draft_text, 1, 80) as preview,
           json_extract(metadata, '$.auto_publish_at') as auto_at,
           json_extract(metadata, '$.auto_publish_cancelled') as auto_cancelled
    FROM posts WHERE status IN ('drafted','approved')
    AND created_at > datetime('now', '-48 hours')
    ORDER BY created_at DESC LIMIT 8
  `).all();

  const outbox = db.prepare(`
    SELECT destination_type, status, substr(content_text, 1, 60) as preview
    FROM outbox WHERE status IN ('pending','scheduled','failed')
    ORDER BY scheduled_at ASC LIMIT 6
  `).all();

  const lines = ['📋 Queue', '', 'Drafts:'];
  if (!drafts.length) lines.push('  (none)');
  else for (const r of drafts) {
    let extra = '';
    if (r.auto_cancelled) extra = ' · cancelled';
    else if (r.auto_at && r.status === 'drafted') {
      const sec = Math.round((new Date(r.auto_at).getTime() - Date.now()) / 1000);
      extra = sec > 0 ? ` · ⏱ ${sec}s` : ' · publishing';
    } else if (r.status === 'approved') extra = ' · queued';
    lines.push(`  • ${r.post_id.slice(-8)} v${r.version} ${r.kind}${extra}`);
  }

  lines.push('', 'Outbox:');
  if (!outbox.length) lines.push('  (empty)');
  else for (const r of outbox) lines.push(`  • ${r.destination_type} · ${r.status} · ${(r.preview || '').slice(0, 40)}`);

  return lines.join('\n');
}

async function buildCalendarText() {
  const now = new Date();
  const start = now.toISOString().slice(0, 10);
  const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT title, currency, event_time_utc, forecast, previous
    FROM events WHERE importance = 'high' AND event_time_utc >= ? AND event_time_utc < ?
      AND COALESCE(NULLIF(TRIM(title), ''), '') <> 'Event'
    ORDER BY event_time_utc ASC LIMIT 12
  `).all(start + 'T00:00:00Z', end + 'T00:00:00Z');

  if (!rows.length) return withSheetFooter(`📅 No high-impact events for ${start}.\nUse /discover_calendar to refresh the macro calendar.`);
  const lines = [`📅 High-impact (${start})`];
  rows.forEach((r, i) => {
    const t = new Date(r.event_time_utc).toISOString().slice(11, 16);
    lines.push(`${i + 1}. ${t} UTC · ${r.currency} ${r.title}`);
    lines.push(`   Fc ${r.forecast || '—'} · Prior ${r.previous || '—'}`);
  });
  return withSheetFooter(lines.join('\n'));
}

async function buildCalendarMonthText() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const rows = db.prepare(`
    SELECT title, currency, event_time_utc, forecast, previous FROM events
    WHERE importance = 'high' AND event_time_utc >= ? AND event_time_utc < ?
      AND COALESCE(NULLIF(TRIM(title), ''), '') <> 'Event'
    ORDER BY event_time_utc ASC LIMIT 40
  `).all(start, end);
  if (!rows.length) return withSheetFooter(`📅 No events this month.\nUse /discover_calendar month to refresh the macro calendar.`);
  const lines = [`📅 ${start.slice(0, 7)} (${rows.length} events)`];
  rows.forEach((r, i) => {
    const t = new Date(r.event_time_utc).toISOString().slice(11, 16);
    lines.push(`${i + 1}. ${t} UTC · ${r.currency} ${r.title}`);
  });
  return withSheetFooter(lines.join('\n'));
}

function getCalendarQueryRange(month) {
  const now = new Date();
  if (month) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    return { start, end };
  }
  const start = now.toISOString().slice(0, 10);
  const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return { start: `${start}T00:00:00Z`, end: `${end}T00:00:00Z` };
}

function getCalendarRows(month) {
  const { start, end } = getCalendarQueryRange(month);
  if (month) {
    return db.prepare(`
      SELECT title, currency, event_time_utc, forecast, previous FROM events
      WHERE importance = 'high' AND event_time_utc >= ? AND event_time_utc < ?
        AND COALESCE(NULLIF(TRIM(title), ''), '') <> 'Event'
      ORDER BY event_time_utc ASC LIMIT 40
    `).all(start, end);
  }
  return db.prepare(`
    SELECT title, currency, event_time_utc, forecast, previous
    FROM events WHERE importance = 'high' AND event_time_utc >= ? AND event_time_utc < ?
      AND COALESCE(NULLIF(TRIM(title), ''), '') <> 'Event'
    ORDER BY event_time_utc ASC LIMIT 12
  `).all(start, end);
}

function formatEmptyCalendarMessage(month, refreshed = false) {
  if (month) {
    return refreshed
      ? '📅 No events this month after refresh.'
      : '📅 No events this month.\nUse /discover_calendar month to refresh the macro calendar.';
  }
  return refreshed
    ? `📅 No high-impact events for today after refresh.`
    : `📅 No high-impact events for today.\nUse /discover_calendar to refresh the macro calendar.`;
}

async function handleCalendarCommand(chatId, month) {
  const rows = getCalendarRows(month);
  if (rows.length) {
    return sendMessage(chatId, month ? await buildCalendarMonthText() : await buildCalendarText());
  }

  await sendMessage(chatId, '⏳ Refreshing Apify calendar…');
  try {
    const result = await discoverMacro({
      daysAhead: month ? 31 : config.apifyDaysAhead,
      force: true,
      caller: 'telegram-command',
    });
    console.log(formatDiscoverSummary(result).replace(/\n/g, ' | '));
    if (!result.ok) {
      return sendMessage(chatId, `⚠️ Calendar refresh failed: ${result.error || 'unknown error'}`);
    }
  } catch (err) {
    console.error('[calendar-discover]', err.message);
    return sendMessage(chatId, `⚠️ Calendar refresh failed: ${err.message}`);
  }

  const refreshedRows = getCalendarRows(month);
  if (!refreshedRows.length) {
    return sendMessage(chatId, withSheetFooter(formatEmptyCalendarMessage(month, true)));
  }
  return sendMessage(chatId, month ? await buildCalendarMonthText() : await buildCalendarText());
}

function handleSettings(args) {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    const s = getDailySettings();
    return [
      '⚙️ Settings',
      `Quote: ${s.dailyQuoteEnabled ? 'ON' : 'OFF'} · ${s.dailyQuoteMode}`,
      'Hadith: OFF (disabled in v2)',
      `Writing: ${s.postToWritingOnApprove ? 'ON' : 'OFF'}`,
      '',
      'Toggle: /settings [quote|writing] on|off',
    ].join('\n');
  }
  const key = parts[0].toLowerCase();
  const val = (parts[1] || '').toLowerCase();
  const map = { writing: 'post_to_writing_on_approve', quote: 'daily_quote_enabled' };
  if (!map[key]) return 'Unknown setting. Use: writing, quote';
  if (!['on', 'off'].includes(val)) return `Usage: /settings ${key} on|off`;
  setSetting(map[key], val === 'on');
  return `✅ ${key} → ${val.toUpperCase()}`;
}

async function handleDiscoverCalendar(argsText) {
  const parts = String(argsText || '').trim().split(/\s+/).filter(Boolean);
  const force = parts.includes('force');
  const month = parts.includes('month');
  const result = await discoverMacro({
    daysAhead: month ? 31 : config.apifyDaysAhead,
    force,
    caller: 'telegram-command',
  });

  if (!result.ok) {
    return `⚠️ Macro discover failed: ${result.error || 'unknown error'}`;
  }

  if (result.skipped) {
    return [
      '🗓 Macro calendar already refreshed today.',
      'Use /discover_calendar force to refresh anyway.',
      `Window: ${month ? 31 : config.apifyDaysAhead} days`,
    ].join('\n');
  }

  return formatDiscoverSummary(result);
}

async function handleSyncSheetCommand(argsText) {
  const parts = String(argsText || '').trim().split(/\s+/).filter(Boolean);
  const days = Number(parts[0] || 31);
  const synced = await syncAllFromDb(db, { days: Number.isFinite(days) && days > 0 ? days : 31 });
  return withSheetFooter([
    '📊 Legacy Sheets synced',
    `Events: ${synced.counts.events}`,
    `Pipeline: ${synced.counts.pipeline}`,
    `Schedule: ${synced.counts.schedule}`,
    synced.sheetError ? `⚠️ Legacy sync blocked: ${synced.sheetError}` : 'Legacy Sheets: updated',
  ].join('\n'));
}
