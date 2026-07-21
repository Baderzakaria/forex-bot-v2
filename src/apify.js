import db from './db.js';
import config from './config.js';
import { enqueue } from './outbox.js';
import { createTokens, keyboard } from './approval.js';
import { formatHighImpactEvent, buildEventKey, countryCodeFromZone, parseEventTimeUtc } from './signals.js';
import { syncAllFromDb } from './sheets.js';

const APIFY_API_BASE = 'https://api.apify.com/v2';
const POLL_INTERVAL_MS = 10_000;
const MAX_RUN_MS = 15 * 60 * 1000;

function normalizeActorId(actorId) {
  return String(actorId || '').trim().replace(/\//g, '~');
}

function normalizeCountries(countries) {
  const list = Array.isArray(countries)
    ? countries
    : String(countries || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return [...new Set(list)];
}

function toIsoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function asText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeEventItem(raw, fallbackCountry) {
  const event_time_utc = parseEventTimeUtc(raw);
  return {
    id: raw.id || raw.eventId || raw.event_id || raw.apify_id || null,
    title: asText(raw.title || raw.event || raw.name || raw.description) || 'Event',
    currency: asText(raw.currency || raw.ccy || raw.symbol) || '',
    country_code: countryCodeFromZone(raw.zone || raw.country || raw.country_code || raw.countryCode || fallbackCountry),
    event_time_utc,
    importance: String(raw.importance || raw.impact || '').trim().toLowerCase() || 'high',
    forecast: asText(raw.forecast || raw.forecastValue || raw.consensus),
    previous: asText(raw.previous || raw.previousValue || raw.prior),
    actual: asText(raw.actual || raw.actualValue),
  };
}

async function apifyJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(options.timeoutMs || 30_000),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message = typeof data === 'string'
      ? data
      : data?.error?.message || data?.message || `Apify request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

async function startActorRun({ actorId, token, input }) {
  const url = `${APIFY_API_BASE}/acts/${actorId}/runs?token=${encodeURIComponent(token)}`;
  const payload = await apifyJson(url, {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 30_000,
  });
  return payload?.data || payload;
}

async function waitForRun({ runId, token }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_RUN_MS) {
    const payload = await apifyJson(`${APIFY_API_BASE}/actor-runs/${runId}?token=${encodeURIComponent(token)}`, {
      timeoutMs: 30_000,
    });
    const run = payload?.data || payload;
    const status = String(run?.status || '').toUpperCase();
    if (status === 'SUCCEEDED') return run;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify run ${runId} ended with ${status}${run?.errorMessage ? `: ${run.errorMessage}` : ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Apify run ${runId} timed out after 15 minutes`);
}

async function fetchDatasetItems({ datasetId, token }) {
  const url = `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true&format=json`;
  const payload = await apifyJson(url, { timeoutMs: 30_000 });
  return Array.isArray(payload) ? payload : [];
}

function upsertEvent(row) {
  const keyInfo = buildEventKey(row, 'apify-macro');
  db.prepare(`
    INSERT INTO events (
      event_key, title, currency, country_code, event_time_utc,
      importance, forecast, previous, actual, source, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'apify', datetime('now'))
    ON CONFLICT(event_key) DO UPDATE SET
      title = excluded.title,
      currency = excluded.currency,
      country_code = excluded.country_code,
      event_time_utc = excluded.event_time_utc,
      importance = excluded.importance,
      forecast = excluded.forecast,
      previous = excluded.previous,
      actual = excluded.actual,
      source = excluded.source,
      captured_at = excluded.captured_at
  `).run(
    keyInfo.event_key,
    row.title,
    row.currency,
    row.country_code,
    keyInfo.event_time_utc,
    row.importance,
    row.forecast,
    row.previous,
    row.actual,
  );
  return keyInfo.event_key;
}

function isRefreshedToday() {
  const row = db.prepare(`
    SELECT captured_at
    FROM events
    WHERE source = 'apify'
    ORDER BY captured_at DESC
    LIMIT 1
  `).get();
  if (!row?.captured_at) return false;
  return String(row.captured_at).slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export async function discoverMacro({ daysAhead = config.apifyDaysAhead, countries = config.apifyCountries, force = false } = {}) {
  if (!config.apifyToken) {
    throw new Error('APIFY_TOKEN missing');
  }

  const countryList = normalizeCountries(countries);
  if (!countryList.length) {
    throw new Error('APIFY_MACRO_COUNTRIES is empty');
  }

  if (!force && isRefreshedToday()) {
    return {
      skipped: true,
      countries: countryList,
      high_count: 0,
      total: 0,
      saved: 0,
      summary: ['Skipped: already refreshed today'],
    };
  }

  const actorId = normalizeActorId(config.apifyActorId);
  const days = Math.max(1, Number(daysAhead || config.apifyDaysAhead || 3));
  const from = toIsoDate(new Date());
  const to = toIsoDate(Date.now() + days * 86400000);

  let total = 0;
  let highCount = 0;
  let saved = 0;
  const summary = [];

  for (const country of countryList) {
    // Match v1 Apify actor input (pintostudio economic calendar)
    const input = {
      timeZone: 'GMT +1:00',
      timeFilter: 'time_only',
      country,
      importances: 'high',
      fromDate: from,
      toDate: to,
    };

    const run = await startActorRun({ actorId, token: config.apifyToken, input });
    const finishedRun = await waitForRun({ runId: run.id || run.runId, token: config.apifyToken });
    const datasetId = finishedRun.defaultDatasetId || run.defaultDatasetId;
    if (!datasetId) {
      throw new Error(`Apify run for ${country} did not return a dataset id`);
    }

    const items = await fetchDatasetItems({ datasetId, token: config.apifyToken });
    const highItems = items
      .map((item) => normalizeEventItem(item, country))
      .filter((item) => String(item.importance).toLowerCase() === 'high');

    total += items.length;
    highCount += highItems.length;

    for (const item of highItems) {
      upsertEvent(item);
      saved++;
    }

    summary.push(`${String(country).toUpperCase()}: ${highItems.length}/${items.length}`);
  }

  void syncAllFromDb(db).catch((err) => {
    console.error('[sheet-sync]', err.message);
  });

  return {
    skipped: false,
    countries: countryList,
    high_count: highCount,
    total,
    saved,
    summary,
  };
}

export function formatDiscoverSummary(result) {
  const parts = [
    `🗓 Macro discover ${result.skipped ? 'skipped' : 'done'}`,
    `Countries: ${result.countries.map((c) => String(c).toUpperCase()).join(', ')}`,
    `High: ${result.high_count} · Total: ${result.total} · Saved: ${result.saved}`,
  ];
  if (Array.isArray(result.summary) && result.summary.length) {
    parts.push('', ...result.summary);
  }
  return parts.join('\n');
}

export function getT30Events(preAlertMinutes = 30) {
  const lead = Math.max(1, Number(preAlertMinutes) || 30);
  const now = Date.now();
  const lower = new Date(now + (lead - 1) * 60_000).toISOString();
  const upper = new Date(now + (lead + 1) * 60_000).toISOString();
  return db.prepare(`
    SELECT event_key, title, currency, country_code, event_time_utc, importance, forecast, previous, actual
    FROM events
    WHERE importance = 'high'
      AND COALESCE(actual, '') = ''
      AND event_time_utc >= ?
      AND event_time_utc <= ?
    ORDER BY event_time_utc ASC
    LIMIT 8
  `).all(lower, upper);
}

export function processT30PreAlerts({ preAlertMinutes = config.preAlertMinutes, adminChatId = config.adminChatId } = {}) {
  const rows = getT30Events(preAlertMinutes);
  let drafted = 0;

  for (const row of rows) {
    const postId = `t30-${row.event_key}`;
    const callbackData = `t30:${row.event_key}`;

    const alreadyQueued = db.prepare(`
      SELECT 1 AS ok
      FROM admin_actions
      WHERE callback_data = ?
      LIMIT 1
    `).get(callbackData);
    if (alreadyQueued) continue;

    const exists = db.prepare(`
      SELECT 1 AS ok
      FROM posts
      WHERE post_id = ? AND version = 1
      LIMIT 1
    `).get(postId);
    if (exists) continue;

    const draftText = formatHighImpactEvent(row, { preAlertMinutes });
    const tokens = createTokens(postId, 1);

    db.prepare(`
      INSERT INTO posts (
        post_id, version, kind, status, requested_by, admin_chat_id,
        request_text, draft_text, llm_model, metadata
      ) VALUES (?, 1, 'macro', 'drafted', 't30-cron', ?, ?, ?, 'apify-calendar', ?)
    `).run(
      postId,
      String(adminChatId || ''),
      't30 pre-alert',
      draftText,
      JSON.stringify({
        event_key: row.event_key,
        kind: 't30',
        pre_alert_minutes: preAlertMinutes,
      }),
    );

    db.prepare(`
      INSERT INTO admin_actions (
        post_id, version, action, actor_user_id, actor_username,
        admin_chat_id, callback_data, metadata
      ) VALUES (?, 1, 'request_preview', 't30-cron', 't30-cron', ?, ?, ?)
    `).run(
      postId,
      String(adminChatId || ''),
      callbackData,
      JSON.stringify({ kind: 't30', event_key: row.event_key }),
    );

    enqueue({
      dedupe_key: `admin:t30:${row.event_key}`,
      destination_type: 'telegram_admin',
      destination_id: String(adminChatId || ''),
      content_text: draftText,
      reply_markup: keyboard(tokens),
      post_id: postId,
      content_version: 1,
      created_by: 't30-cron',
    });

    drafted++;
  }

  return { drafted, rows };
}
