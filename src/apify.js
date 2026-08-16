import db from './db.js';
import config from './config.js';
import { enqueue, setSetting } from './outbox.js';
import { createTokens, keyboard } from './approval.js';
import { sendMessage } from './telegram.js';
import {
  formatHighImpactEvent,
  formatReleaseAlert,
  formatActualAlert,
  buildEventKey,
  countryCodeFromZone,
  parseEventTimeUtc,
} from './signals.js';
import { syncAllFromDb } from './sheets.js';

const APIFY_API_BASE = 'https://api.apify.com/v2';
const POLL_INTERVAL_MS = 10_000;
const MAX_RUN_MS = 15 * 60 * 1000;
const APIFY_ERROR_NOTICE_MS = 15 * 60 * 1000;
const MAX_DRAFTS_PER_TICK = 3;
const APIFY_ACTUAL_RELEASE_WINDOW_MS = 3 * 60 * 1000;

const COUNTRY_NAME_BY_CODE = {
  US: 'united states',
  GB: 'united kingdom',
  DE: 'germany',
  JP: 'japan',
  CH: 'switzerland',
  CA: 'canada',
  AU: 'australia',
  NZ: 'new zealand',
  EU: 'euro zone',
};

class ApifyPipelineError extends Error {
  constructor(message, code, meta = {}) {
    super(message);
    this.name = 'ApifyPipelineError';
    this.code = code;
    this.meta = meta;
  }
}

class ApifyActorError extends ApifyPipelineError {
  constructor(message, meta = {}) {
    super(message, 'APIFY_ACTOR_FAIL', meta);
    this.name = 'ApifyActorError';
  }
}

class ApifyTimeoutError extends ApifyPipelineError {
  constructor(message, meta = {}) {
    super(message, 'APIFY_TIMEOUT', meta);
    this.name = 'ApifyTimeoutError';
  }
}

class ApifyParseError extends ApifyPipelineError {
  constructor(message, meta = {}) {
    super(message, 'APIFY_PARSE', meta);
    this.name = 'ApifyParseError';
  }
}

function isSmokeTitle(title) {
  const text = String(title || '').trim().toLowerCase();
  return text.startsWith('selftest') || text.startsWith('smoke ');
}

function truncateText(value, max = 180) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function compactErrorMessage(error) {
  if (!error) return '';
  const code = error.code ? `${error.code}: ` : '';
  return truncateText(`${code}${error.message || error}`, 180);
}

function summariseCountries(countries) {
  const values = normalizeCountries(countries);
  return values.length ? values.map((country) => String(country).toUpperCase()).join(', ') : 'ALL';
}

function countryNameFromCode(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  return COUNTRY_NAME_BY_CODE[code] || String(countryCode || '').trim().toLowerCase();
}

function eventDateUtc(value) {
  return String(value || '').slice(0, 10);
}

function buildWindowText(fromDate, toDate) {
  return `${fromDate || 'n/a'}..${toDate || 'n/a'}`;
}

function buildRunSummary(result) {
  const parts = [
    `caller=${result.caller}`,
    `countries=${summariseCountries(result.countries) || 'none'}`,
    `window=${buildWindowText(result.fromDate, result.toDate)}`,
    `started_at=${result.started_at || 'n/a'}`,
    `duration_ms=${result.duration_ms ?? 'n/a'}`,
    `saved=${result.saved ?? 0}`,
    `skipped=${result.skipped ? 'true' : 'false'}`,
    `high_count=${result.high_count ?? 0}`,
    `rejected=${result.rejected ?? 0}`,
    `ok=${result.ok ? 'true' : 'false'}`,
  ];
  if (result.error) parts.push(`error=${truncateText(result.error, 120)}`);
  return parts.join(' ');
}

function persistRunState(result) {
  setSetting('apify_last_run_at', result.finished_at || new Date().toISOString());
  setSetting('apify_last_run_caller', result.caller || '');
  setSetting('apify_last_run_ok', result.ok ? 'true' : 'false');
  setSetting('apify_last_run_summary', truncateText(buildRunSummary(result), 240));
}

function logRun(result) {
  console.log('[apify-run]', buildRunSummary(result));
}

async function maybeNotifyAdminOfFailure(result) {
  if (!config.adminChatId || result.ok || !result.error || !config.apifyToken) return;

  const lastNotice = db.prepare(`SELECT value FROM settings WHERE key = 'apify_last_error_notice_at'`).get();
  const lastNoticeMs = lastNotice?.value ? new Date(lastNotice.value).getTime() : 0;
  if (Number.isFinite(lastNoticeMs) && Date.now() - lastNoticeMs < APIFY_ERROR_NOTICE_MS) {
    return;
  }

  setSetting('apify_last_error_notice_at', new Date().toISOString());
  try {
    await sendMessage(
      config.adminChatId,
      [
        `⚠️ Apify ${result.caller} failed`,
        `Error: ${compactErrorMessage(result.error)}`,
        `Window: ${buildWindowText(result.fromDate, result.toDate)}`,
      ].join('\n'),
    );
  } catch (err) {
    console.error('[apify-run] admin notice failed', err.message);
  }
}

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

const PLACEHOLDER_TITLES = new Set(['event', 'n/a', 'na', 'unknown', 'null', 'undefined']);

function normalizeTitle(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPlaceholderTitle(title) {
  return !title || PLACEHOLDER_TITLES.has(normalizeTitle(title));
}

function hasMeaningfulEventFields(raw) {
  return [
    raw.forecast || raw.forecastValue || raw.consensus,
    raw.previous || raw.previousValue || raw.prior,
    raw.actual || raw.actualValue,
  ].some((value) => asText(value));
}

function hasStrongEventTitle(title) {
  return String(title || '').trim().length >= 4;
}

function isUsableEventRow(row) {
  const title = asText(row.title);
  const currency = asText(row.currency);

  if (isPlaceholderTitle(title)) return false;
  if (isSmokeTitle(title)) return false;
  if (!hasStrongEventTitle(title)) return false;
  if (!currency) return false;
  if (!hasMeaningfulEventFields(row) && !asText(row.actual)) return false;
  return true;
}

function ensureAlertState(eventKey) {
  db.prepare(`
    INSERT OR IGNORE INTO event_alert_state (event_key)
    VALUES (?)
  `).run(eventKey);
}

function markActualApifyRequest(eventKey, scope, requestedAt) {
  markAlertState(eventKey, {
    actual_apify_requested_at: requestedAt,
    actual_apify_request_scope: scope,
  });
}

function markActualApifyFetched(eventKey, fetchedAt) {
  markAlertState(eventKey, {
    actual_apify_fetched_at: fetchedAt,
  });
}

function markAlertState(eventKey, patch = {}) {
  ensureAlertState(eventKey);
  const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
  if (!keys.length) {
    db.prepare(`
      UPDATE event_alert_state
      SET refreshed_at = datetime('now')
      WHERE event_key = ?
    `).run(eventKey);
    return;
  }

  const sets = keys.map((key) => `${key} = ?`);
  const values = keys.map((key) => patch[key]);
  values.push(eventKey);

  db.prepare(`
    UPDATE event_alert_state
    SET ${sets.join(', ')}, refreshed_at = datetime('now')
    WHERE event_key = ?
  `).run(...values);
}

function normalizeEventItem(raw, fallbackCountry) {
  const title = asText(raw.title || raw.event || raw.name);
  const forecast = asText(raw.forecast || raw.forecastValue || raw.consensus);
  const previous = asText(raw.previous || raw.previousValue || raw.prior);
  const actual = asText(raw.actual || raw.actualValue);
  const currency = asText(raw.currency || raw.ccy || raw.symbol);

  if (isPlaceholderTitle(title)) {
    return null;
  }

  const event_time_utc = parseEventTimeUtc(raw);
  if (!event_time_utc) {
    return null;
  }

  if (!forecast && !previous && !actual && !currency) {
    return null;
  }

  if (!forecast && !previous && !actual && !(hasStrongEventTitle(title) && currency)) {
    return null;
  }

  return {
    id: raw.id || raw.eventId || raw.event_id || raw.apify_id || null,
    title,
    currency: currency || '',
    country_code: countryCodeFromZone(raw.zone || raw.country || raw.country_code || raw.countryCode || fallbackCountry),
    event_time_utc,
    importance: String(raw.importance || raw.impact || '').trim().toLowerCase() || 'high',
    forecast,
    previous,
    actual,
  };
}

function getDueActualApifyEvents({ windowMs = APIFY_ACTUAL_RELEASE_WINDOW_MS } = {}) {
  const leadMs = Math.max(60_000, Number(windowMs) || APIFY_ACTUAL_RELEASE_WINDOW_MS);
  const now = Date.now();
  const lower = new Date(now - 60_000).toISOString();
  const upper = new Date(now + Math.max(60_000, leadMs - 60_000)).toISOString();
  return db.prepare(`
    SELECT e.event_key, e.title, e.currency, e.country_code, e.event_time_utc, e.importance,
           e.forecast, e.previous, e.actual,
           s.actual_apify_requested_at, s.actual_apify_fetched_at, s.actual_apify_request_scope
    FROM events e
    LEFT JOIN event_alert_state s ON s.event_key = e.event_key
    WHERE e.importance = 'high'
      AND LENGTH(TRIM(COALESCE(e.title, ''))) > 0
      AND LOWER(TRIM(COALESCE(e.title, ''))) NOT IN ('event', 'n/a', 'na', 'unknown', 'null', 'undefined')
      AND COALESCE(e.actual, '') = ''
      AND COALESCE(s.actual_apify_requested_at, '') = ''
      AND e.event_time_utc >= ?
      AND e.event_time_utc <= ?
    ORDER BY e.event_time_utc ASC
  `).all(lower, upper);
}

function groupDueActualApifyEvents(rows) {
  const groups = new Map();
  for (const row of rows) {
    const countryCode = String(row.country_code || '').trim().toUpperCase() || 'XX';
    const eventDate = eventDateUtc(row.event_time_utc);
    const key = `${countryCode}|${eventDate}`;
    if (!groups.has(key)) {
      groups.set(key, {
        country_code: countryCode,
        event_date: eventDate,
        country_name: countryNameFromCode(countryCode),
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

async function apifyJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      signal: options.signal || AbortSignal.timeout(options.timeoutMs || 30_000),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    throw new ApifyPipelineError(err.message || 'Apify request failed', 'APIFY_HTTP', { cause: err });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new ApifyParseError('Apify response was not valid JSON', { responseText: truncateText(text, 200) });
    }
  }
  if (!res.ok) {
    const message = data?.error?.message || data?.message || `Apify request failed (${res.status})`;
    throw new ApifyPipelineError(message, 'APIFY_HTTP', { status: res.status, url });
  }
  return data;
}

async function startActorRun({ actorId, token, input }) {
  const url = `${APIFY_API_BASE}/acts/${actorId}/runs?token=${encodeURIComponent(token)}`;
  try {
    const payload = await apifyJson(url, {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 30_000,
    });
    return payload?.data || payload;
  } catch (err) {
    throw new ApifyActorError(`Failed to start Apify actor run: ${compactErrorMessage(err)}`, { cause: err });
  }
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
      throw new ApifyActorError(`Apify run ${runId} ended with ${status}${run?.errorMessage ? `: ${run.errorMessage}` : ''}`, { runId, status });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new ApifyTimeoutError(`Apify run ${runId} timed out after 15 minutes`, { runId });
}

async function fetchDatasetItems({ datasetId, token }) {
  const url = `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true&format=json`;
  try {
    const payload = await apifyJson(url, { timeoutMs: 30_000 });
    if (!Array.isArray(payload)) {
      throw new ApifyParseError('Apify dataset response was not an array', { datasetId });
    }
    return payload;
  } catch (err) {
    if (err instanceof ApifyPipelineError) throw err;
    throw new ApifyParseError(`Failed to parse Apify dataset ${datasetId}`, { cause: err, datasetId });
  }
}

function upsertEvent(row) {
  const keyInfo = buildEventKey(row, 'apify-macro');
  const existing = db.prepare(`
    SELECT actual
    FROM events
    WHERE event_key = ?
  `).get(keyInfo.event_key);

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

  if (!existing?.actual && row.actual) {
    markAlertState(keyInfo.event_key, {
      last_actual: row.actual,
      actual_first_seen_at: new Date().toISOString(),
    });
  } else if (row.actual) {
    markAlertState(keyInfo.event_key, { last_actual: row.actual });
  } else {
    ensureAlertState(keyInfo.event_key);
  }

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

async function runMacroDiscovery({
  countries = [],
  fromDate,
  toDate,
}) {
  const countryList = normalizeCountries(countries);
  const isAllCountries = countryList.length === 0;

  const actorId = normalizeActorId(config.apifyActorId);
  let total = 0;
  let highCount = 0;
  let saved = 0;
  let rejected = 0;
  const summary = [];

  for (const country of (isAllCountries ? [null] : countryList)) {
    // The actor input schema makes `country` optional. Omitting it fetches all
    // supported countries in one run; high importance and the date window stay
    // mandatory here to keep returned rows and cost bounded.
    const input = {
      timeZone: 'GMT +1:00',
      timeFilter: 'time_only',
      importances: 'high',
      fromDate,
      toDate,
    };
    if (country) input.country = country;

    const run = await startActorRun({ actorId, token: config.apifyToken, input });
    const finishedRun = await waitForRun({ runId: run.id || run.runId, token: config.apifyToken });
    const datasetId = finishedRun.defaultDatasetId || run.defaultDatasetId;
    if (!datasetId) {
      throw new ApifyParseError(`Apify run for ${country || 'all countries'} did not return a dataset id`, { country });
    }

    const items = await fetchDatasetItems({ datasetId, token: config.apifyToken });
    const normalizedItems = items.map((item) => normalizeEventItem(item, country));
    const usableItems = normalizedItems.filter(Boolean);
    const highItems = usableItems.filter((item) => String(item.importance).toLowerCase() === 'high');
    const rejectedItems = items.length - usableItems.length;

    total += items.length;
    highCount += highItems.length;
    rejected += rejectedItems;

    for (const item of highItems) {
      upsertEvent(item);
      saved++;
    }

    summary.push(`${country ? String(country).toUpperCase() : 'ALL COUNTRIES'}: saved ${highItems.length}/${items.length} (rejected ${rejectedItems})`);
  }

  return {
    skipped: false,
    countries: isAllCountries ? ['all'] : countryList,
    high_count: highCount,
    total,
    saved,
    rejected,
    summary,
  };
}

async function executeDiscovery({
  caller = 'cron-discover',
  daysAhead,
  countries,
  force = false,
  fromDate,
  toDate,
}) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const countryList = normalizeCountries(countries);
  const requestedCountries = countryList.length ? countryList : ['all'];
  const baseResult = {
    ok: false,
    caller,
    started_at: startedAt,
    duration_ms: 0,
    countries: requestedCountries,
    fromDate,
    toDate,
    skipped: false,
    high_count: 0,
    total: 0,
    saved: 0,
    rejected: 0,
    summary: [],
    error: '',
  };

  console.log('[apify-run:start]', buildRunSummary(baseResult));

  try {
    if (!config.apifyToken) {
      const response = {
        ...baseResult,
        ok: true,
        skipped: true,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        summary: ['Skipped: APIFY_TOKEN disabled'],
        error: '',
      };

      persistRunState(response);
      logRun(response);
      return response;
    }
    let result;
    if (!force && !fromDate && !toDate && isRefreshedToday()) {
      result = {
        skipped: true,
        countries: requestedCountries,
        high_count: 0,
        total: 0,
        saved: 0,
        rejected: 0,
        summary: ['Skipped: already refreshed today'],
      };
    } else if (fromDate && toDate) {
      result = await runMacroDiscovery({ countries: countryList, fromDate, toDate });
    } else {
      const days = Math.max(1, Number(daysAhead || config.apifyDaysAhead || 3));
      const discoveredFrom = toIsoDate(new Date());
      const discoveredTo = toIsoDate(Date.now() + days * 86400000);
      result = await runMacroDiscovery({
        countries: countryList,
        fromDate: discoveredFrom,
        toDate: discoveredTo,
      });
      fromDate = discoveredFrom;
      toDate = discoveredTo;
    }

    void syncAllFromDb(db).catch((err) => {
      console.error('[sheet-sync]', err.message);
    });

    const finishedAt = new Date().toISOString();
    const response = {
      ok: true,
      caller,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: Date.now() - startedMs,
      countries: result.countries || requestedCountries,
      fromDate,
      toDate,
      ...result,
      error: '',
    };

    persistRunState(response);
    logRun(response);
    return response;
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const response = {
      ...baseResult,
      ok: false,
      finished_at: finishedAt,
      duration_ms: Date.now() - startedMs,
      error: compactErrorMessage(err),
    };

    persistRunState(response);
    logRun(response);
    await maybeNotifyAdminOfFailure(response);
    return response;
  }
}

export async function discoverMacro({
  daysAhead = config.apifyDaysAhead,
  countries = [],
  force = false,
  caller = 'cron-discover',
} = {}) {
  return executeDiscovery({
    caller,
    daysAhead,
    countries,
    force,
  });
}

export async function refreshRecentActuals({ countries = [], caller = 'manual-refresh' } = {}) {
  const countryList = normalizeCountries(countries);
  const fromDate = toIsoDate(Date.now() - 86400000);
  const toDate = toIsoDate(Date.now() + 86400000);
  return executeDiscovery({
    caller,
    countries: countryList,
    fromDate,
    toDate,
    force: true,
  });
}

export async function processDueApifyActualFetches({
  caller = 'cron-actual-fetch',
  windowMs = APIFY_ACTUAL_RELEASE_WINDOW_MS,
} = {}) {
  // This is the only on-event Apify path: it targets one country/day window
  // for high-impact events that have reached release time but still lack an actual.
  const rows = getDueActualApifyEvents({ windowMs });
  if (!rows.length) {
    return {
      ok: true,
      skipped: true,
      caller,
      groups: 0,
      events: 0,
      summary: ['Skipped: no due high-impact events with missing actuals'],
    };
  }

  if (!config.apifyToken) {
    return {
      ok: true,
      skipped: true,
      caller,
      groups: 0,
      events: rows.length,
      summary: ['Skipped: APIFY_TOKEN disabled'],
    };
  }

  const groups = groupDueActualApifyEvents(rows);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const summary = [];
  let requestedEvents = 0;
  let fetchedEvents = 0;
  let fetchedGroups = 0;
  let hadFailure = false;

  for (const group of groups) {
    const requestedAt = new Date().toISOString();
    const scope = `${group.country_code} ${group.event_date}`;
    requestedEvents += group.rows.length;
    for (const row of group.rows) {
      markActualApifyRequest(row.event_key, scope, requestedAt);
    }

    console.log(`[apify-actual-fetch:start] caller=${caller} country=${group.country_code} date=${group.event_date} events=${group.rows.length}`);

    const result = await discoverMacro({
      caller: `${caller}:${scope}`,
      countries: [group.country_name],
      fromDate: group.event_date,
      toDate: group.event_date,
      force: true,
    });

    if (result.ok) {
      const fetchedAt = new Date().toISOString();
      for (const row of group.rows) {
        markActualApifyFetched(row.event_key, fetchedAt);
      }
      fetchedGroups++;
      fetchedEvents += group.rows.length;
      summary.push(`Targeted ${scope}: ${result.summary?.join(' | ') || 'ok'}`);
      continue;
    }

    hadFailure = true;
    summary.push(`Targeted ${scope}: ${result.error || 'failed'}`);
  }

  return {
    ok: !hadFailure,
    caller,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    skipped: false,
    groups: groups.length,
    fetched_groups: fetchedGroups,
    events: fetchedEvents,
    requested_events: requestedEvents,
    summary,
    error: hadFailure ? 'One or more targeted actual fetches failed' : '',
  };
}

export function formatDiscoverSummary(result) {
  const parts = [
    `🗓 Macro discover ${result.ok === false ? 'failed' : (result.skipped ? 'skipped' : 'done')}`,
    `Countries: ${result.countries.map((c) => String(c).toUpperCase()).join(', ')}`,
    `High: ${result.high_count} · Total: ${result.total} · Saved: ${result.saved} · Rejected: ${result.rejected || 0}`,
  ];
  if (result.error) {
    parts.push(`Error: ${result.error}`);
  }
  if (Array.isArray(result.summary) && result.summary.length) {
    parts.push('', ...result.summary);
  }
  return parts.join('\n');
}

export function formatActualFetchSummary(result) {
  const parts = [
    `🎯 Targeted actual fetch ${result.ok === false ? 'failed' : (result.skipped ? 'skipped' : 'done')}`,
    `Groups: ${result.groups || 0} · Fetched: ${result.fetched_groups || 0} · Events: ${result.events || 0} · Requested: ${result.requested_events || 0}`,
  ];
  if (result.error) {
    parts.push(`Error: ${result.error}`);
  }
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
      AND LENGTH(TRIM(COALESCE(title, ''))) > 0
      AND LOWER(TRIM(COALESCE(title, ''))) NOT IN ('event', 'n/a', 'na', 'unknown', 'null', 'undefined')
      AND COALESCE(actual, '') = ''
      AND (
        COALESCE(NULLIF(TRIM(forecast), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(previous), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(actual), ''), '') <> ''
        OR (
          LENGTH(TRIM(COALESCE(title, ''))) >= 4
          AND COALESCE(NULLIF(TRIM(currency), ''), '') <> ''
        )
      )
      AND (
        LENGTH(TRIM(COALESCE(title, ''))) >= 4
        OR COALESCE(NULLIF(TRIM(currency), ''), '') <> ''
      )
      AND event_time_utc >= ?
      AND event_time_utc <= ?
    ORDER BY event_time_utc ASC
    LIMIT 8
  `).all(lower, upper);
}

export function getT0Events() {
  const now = Date.now();
  const lower = new Date(now - 60_000).toISOString();
  const upper = new Date(now + 60_000).toISOString();
  return db.prepare(`
    SELECT event_key, title, currency, country_code, event_time_utc, importance, forecast, previous, actual
    FROM events
    WHERE importance = 'high'
      AND LENGTH(TRIM(COALESCE(title, ''))) > 0
      AND LOWER(TRIM(COALESCE(title, ''))) NOT IN ('event', 'n/a', 'na', 'unknown', 'null', 'undefined')
      AND COALESCE(actual, '') = ''
      AND (
        COALESCE(NULLIF(TRIM(forecast), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(previous), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(actual), ''), '') <> ''
        OR (
          LENGTH(TRIM(COALESCE(title, ''))) >= 4
          AND COALESCE(NULLIF(TRIM(currency), ''), '') <> ''
        )
      )
      AND (
        LENGTH(TRIM(COALESCE(title, ''))) >= 4
        OR COALESCE(NULLIF(TRIM(currency), ''), '') <> ''
      )
      AND event_time_utc >= ?
      AND event_time_utc <= ?
    ORDER BY event_time_utc ASC
    LIMIT 8
  `).all(lower, upper);
}

export function getRecentActualEvents({ lookbackMinutes = config.actualLookbackMinutes } = {}) {
  const now = Date.now();
  const lower = new Date(now - Math.max(5, Number(lookbackMinutes) || 120) * 60_000).toISOString();
  const upper = new Date(now + 5 * 60_000).toISOString();
  const recentActual = new Date(now - Math.max(5, Number(lookbackMinutes) || 120) * 60_000).toISOString();
  return db.prepare(`
    SELECT e.event_key, e.title, e.currency, e.country_code, e.event_time_utc, e.importance, e.forecast, e.previous, e.actual,
           s.actual_first_seen_at, s.actual_posted_at, s.t0_posted_at
    FROM events e
    LEFT JOIN event_alert_state s ON s.event_key = e.event_key
    WHERE e.importance = 'high'
      AND LENGTH(TRIM(COALESCE(e.title, ''))) > 0
      AND LOWER(TRIM(COALESCE(e.title, ''))) NOT IN ('event', 'n/a', 'na', 'unknown', 'null', 'undefined')
      AND COALESCE(e.actual, '') <> ''
      AND COALESCE(s.actual_posted_at, '') = ''
      AND (
        COALESCE(NULLIF(TRIM(e.forecast), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(e.previous), ''), '') <> ''
        OR COALESCE(NULLIF(TRIM(e.actual), ''), '') <> ''
        OR (
          LENGTH(TRIM(COALESCE(e.title, ''))) >= 4
          AND COALESCE(NULLIF(TRIM(e.currency), ''), '') <> ''
        )
      )
      AND (
        LENGTH(TRIM(COALESCE(e.title, ''))) >= 4
        OR COALESCE(NULLIF(TRIM(e.currency), ''), '') <> ''
      )
      AND (
        (e.event_time_utc >= ? AND e.event_time_utc <= ?)
        OR COALESCE(s.actual_first_seen_at, '') >= ?
      )
    ORDER BY e.event_time_utc ASC
    LIMIT 8
  `).all(lower, upper, recentActual);
}

export function processT0ReleaseAlerts({ adminChatId = config.adminChatId } = {}) {
  if (!config.releaseAlertEnabled) {
    return { drafted: 0, rows: [] };
  }

  const rows = getT0Events();
  let drafted = 0;

  for (const row of rows) {
    if (drafted >= MAX_DRAFTS_PER_TICK) break;
    if (!isUsableEventRow(row)) continue;
    const postId = `t0-${row.event_key}`;
    const callbackData = `t0:${row.event_key}`;

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

    const draftText = formatReleaseAlert(row);
    const tokens = createTokens(postId, 1);

    db.prepare(`
      INSERT INTO posts (
        post_id, version, kind, status, requested_by, admin_chat_id,
        request_text, draft_text, llm_model, metadata
      ) VALUES (?, 1, 't0', 'drafted', 't0-cron', ?, ?, ?, 'apify-calendar', ?)
    `).run(
      postId,
      String(adminChatId || ''),
      'release now',
      draftText,
      JSON.stringify({
        event_key: row.event_key,
        kind: 't0',
      }),
    );

    db.prepare(`
      INSERT INTO admin_actions (
        post_id, version, action, actor_user_id, actor_username,
        admin_chat_id, callback_data, metadata
      ) VALUES (?, 1, 'request_preview', 't0-cron', 't0-cron', ?, ?, ?)
    `).run(
      postId,
      String(adminChatId || ''),
      callbackData,
      JSON.stringify({ kind: 't0', event_key: row.event_key }),
    );

    markAlertState(row.event_key, { t0_posted_at: new Date().toISOString() });

    enqueue({
      dedupe_key: `admin:t0:${row.event_key}`,
      destination_type: 'telegram_admin',
      destination_id: String(adminChatId || ''),
      content_text: draftText,
      reply_markup: keyboard(tokens),
      post_id: postId,
      content_version: 1,
      created_by: 't0-cron',
    });

    drafted++;
  }

  return { drafted, rows };
}

export function processActualAlerts({ adminChatId = config.adminChatId, lookbackMinutes = config.actualLookbackMinutes } = {}) {
  if (!config.actualAlertEnabled) {
    return { drafted: 0, rows: [] };
  }

  const rows = getRecentActualEvents({ lookbackMinutes });
  let drafted = 0;

  for (const row of rows) {
    if (drafted >= MAX_DRAFTS_PER_TICK) break;
    if (!isUsableEventRow(row)) continue;
    const postId = `actual-${row.event_key}`;
    const callbackData = `actual:${row.event_key}`;

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

    const draftText = formatActualAlert(row);
    const tokens = createTokens(postId, 1);

    db.prepare(`
      INSERT INTO posts (
        post_id, version, kind, status, requested_by, admin_chat_id,
        request_text, draft_text, llm_model, metadata
      ) VALUES (?, 1, 'actual', 'drafted', 'actual-cron', ?, ?, ?, 'apify-calendar', ?)
    `).run(
      postId,
      String(adminChatId || ''),
      'actual release follow-up',
      draftText,
      JSON.stringify({
        event_key: row.event_key,
        kind: 'actual',
      }),
    );

    db.prepare(`
      INSERT INTO admin_actions (
        post_id, version, action, actor_user_id, actor_username,
        admin_chat_id, callback_data, metadata
      ) VALUES (?, 1, 'request_preview', 'actual-cron', 'actual-cron', ?, ?, ?)
    `).run(
      postId,
      String(adminChatId || ''),
      callbackData,
      JSON.stringify({ kind: 'actual', event_key: row.event_key }),
    );

    markAlertState(row.event_key, {
      actual_posted_at: new Date().toISOString(),
      last_actual: row.actual,
    });

    enqueue({
      dedupe_key: `admin:actual:${row.event_key}`,
      destination_type: 'telegram_admin',
      destination_id: String(adminChatId || ''),
      content_text: draftText,
      reply_markup: keyboard(tokens),
      post_id: postId,
      content_version: 1,
      created_by: 'actual-cron',
    });

    drafted++;
  }

  return { drafted, rows };
}

export function processT30PreAlerts({ preAlertMinutes = config.preAlertMinutes, adminChatId = config.adminChatId } = {}) {
  const rows = getT30Events(preAlertMinutes);
  let drafted = 0;

  for (const row of rows) {
    if (drafted >= MAX_DRAFTS_PER_TICK) break;
    if (!isUsableEventRow(row)) continue;
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
