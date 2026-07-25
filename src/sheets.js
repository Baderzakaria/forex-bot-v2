import fs from 'fs';
import config from './config.js';
import db from './db.js';

function getSheetId() {
  return String(config.googleSheetId || '').trim();
}

function getTokenPath() {
  return String(config.googleOAuthTokenPath || process.env.GOOGLE_OAUTH_TOKEN_PATH || '').trim();
}

function getCredentialsPath() {
  return String(config.googleOAuthCredentialsPath || process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || '').trim();
}

function getFallbackTokenPaths() {
  return [
    '/home/bader/Desktop/SML_projects/automationsL/.google_drive_token_rw.json',
    '/home/bader/Desktop/SML_projects/automationsL/.google_drive_token.json',
  ];
}

function sheetApiBase(sheetId = getSheetId()) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
}

function toIso(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toUtcDate(value) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : '';
}

function toUtcTime(value) {
  const iso = toIso(value);
  return iso ? iso.slice(11, 16) : '';
}

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function preview(value, max = 90) {
  const s = text(value).replace(/\s+/g, ' ');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function addMinutes(isoValue, minutes) {
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - Number(minutes || 0) * 60_000).toISOString();
}

function eventDayLink(event) {
  const d = new Date(event.event_time_utc);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return `https://www.forexfactory.com/calendar?day=${months[d.getUTCMonth()]}${d.getUTCDate()}.${d.getUTCFullYear()}`;
}

function sortByIso(a, b) {
  return String(a).localeCompare(String(b));
}

export function sheetUrl() {
  const explicit = String(config.googleSheetUrl || '').trim();
  if (explicit) return explicit;
  const id = getSheetId();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : '';
}

export async function getGoogleAccessToken() {
  const credentialsPath = getCredentialsPath();
  const candidatePaths = [...new Set([
    getTokenPath(),
    ...getFallbackTokenPaths(),
  ])].filter(Boolean);

  let credentials;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    try {
      credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    } catch (err) {
      throw new Error(`Unable to read Google credentials file: ${err.message}`);
    }
  }

  for (const tokenPath of candidatePaths) {
    if (!fs.existsSync(tokenPath)) continue;

    let tokenData;
    try {
      tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    } catch (err) {
      throw new Error(`Unable to read Google token file: ${err.message}`);
    }

    const expiryValue = tokenData?.expiry_date || tokenData?.expiry || tokenData?.expires_at || '';
    const expiryMs = expiryValue ? new Date(expiryValue).getTime() : NaN;
    if (tokenData?.token && Number.isFinite(expiryMs) && Date.now() < expiryMs - 60_000) {
      return tokenData.token;
    }
    if (tokenData?.token && !expiryValue) {
      return tokenData.token;
    }

    const clientId = credentials?.installed?.client_id || credentials?.web?.client_id || tokenData?.client_id || '';
    const clientSecret = credentials?.installed?.client_secret || credentials?.web?.client_secret || tokenData?.client_secret || '';
    if (!tokenData?.refresh_token || !clientId || !clientSecret) {
      if (tokenData?.token) continue;
      return null;
    }

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token',
      });
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = payload?.error_description || payload?.error || `Google token refresh failed (${res.status})`;
        throw new Error(message);
      }

      tokenData.token = payload.access_token;
      tokenData.expiry_date = Date.now() + Number(payload.expires_in || 3600) * 1000;
      try {
        fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
      } catch {
        // Token store may be read-only in some deployments.
      }
      return tokenData.token;
    } catch (err) {
      if (tokenData?.token) continue;
      throw err;
    }
  }

  return null;
}

export async function ensureSheetTab(tab) {
  const sheetId = getSheetId();
  if (!sheetId) return { ok: false, reason: 'missing_sheet_id' };

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return { ok: false, reason: 'missing_token' };

  const metaRes = await fetch(`${sheetApiBase(sheetId)}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json().catch(() => ({}));
  if (!metaRes.ok) {
    throw new Error(meta?.error?.message || `Failed to read sheet metadata (${metaRes.status})`);
  }

  const titles = (meta.sheets || []).map((sheet) => sheet?.properties?.title).filter(Boolean);
  if (titles.includes(tab)) {
    return { ok: true, created: false, tab };
  }

  const addRes = await fetch(`${sheetApiBase(sheetId)}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: tab } } }],
    }),
  });
  const addPayload = await addRes.json().catch(() => ({}));
  if (!addRes.ok) {
    throw new Error(addPayload?.error?.message || `Failed to create sheet tab ${tab} (${addRes.status})`);
  }
  return { ok: true, created: true, tab };
}

export async function writeSheetRange(tab, rangeA1, values) {
  const sheetId = getSheetId();
  if (!sheetId) return { ok: false, reason: 'missing_sheet_id' };

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return { ok: false, reason: 'missing_token' };

  const range = `${tab}!${rangeA1}`;
  const clearRes = await fetch(`${sheetApiBase(sheetId)}/values/${encodeURIComponent(tab)}:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const clearPayload = await clearRes.json().catch(() => ({}));
  if (!clearRes.ok) {
    throw new Error(clearPayload?.error?.message || `Failed to clear ${range} (${clearRes.status})`);
  }

  const writeRes = await fetch(`${sheetApiBase(sheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });
  const writePayload = await writeRes.json().catch(() => ({}));
  if (!writeRes.ok) {
    throw new Error(writePayload?.error?.message || `Failed to write ${range} (${writeRes.status})`);
  }

  return {
    ok: true,
    sheetId,
    tab,
    range,
    rows: values.length,
    updatedRows: writePayload.updatedRows ?? values.length,
    updatedColumns: writePayload.updatedColumns ?? (values[0]?.length || 0),
  };
}

export async function syncEventsTab(events = []) {
  await ensureSheetTab('events');
  const header = ['event_key', 'title', 'currency', 'country_code', 'event_time_utc', 'importance', 'forecast', 'previous', 'actual', 'status', 'alert_at'];
  const now = Date.now();
  const rows = [...events]
    .sort((a, b) => sortByIso(a.event_time_utc, b.event_time_utc))
    .map((event) => {
      const alertAt = addMinutes(event.event_time_utc, config.preAlertMinutes);
      const status = event.actual ? 'released' : (new Date(alertAt).getTime() <= now ? 'alerted' : 'planned');
      return [
        text(event.event_key),
        text(event.title),
        text(event.currency),
        text(event.country_code).toUpperCase(),
        toIso(event.event_time_utc),
        text(event.importance || 'high'),
        text(event.forecast),
        text(event.previous),
        text(event.actual),
        status,
        alertAt,
      ];
    });
  const result = await writeSheetRange('events', 'A1', [header, ...rows]);
  return { ok: true, count: rows.length, result };
}

export async function syncPipelineTab(events = []) {
  await ensureSheetTab('pipeline');
  const header = ['date', 'event', 'currency', 'importance', 'draft_status', 'draft_text', 'notes', 'link'];
  const rows = [...events]
    .sort((a, b) => sortByIso(a.event_time_utc, b.event_time_utc))
    .map((event) => {
      const alertAt = addMinutes(event.event_time_utc, config.preAlertMinutes);
      return [
        toUtcDate(event.event_time_utc),
        text(event.title),
        text(event.currency),
        text(event.importance || 'high'),
        'planned',
        '',
        `alert_at=${alertAt}`,
        eventDayLink(event),
      ];
    });
  const result = await writeSheetRange('pipeline', 'A1', [header, ...rows]);
  return { ok: true, count: rows.length, result };
}

export async function syncScheduleTab(rows = []) {
  await ensureSheetTab('schedule');
  const header = ['date', 'time_utc', 'type', 'title', 'status', 'destination', 'notes'];
  const data = [...rows]
    .map((row) => ([
      text(row.date),
      text(row.time_utc),
      text(row.type),
      text(row.title),
      text(row.status),
      text(row.destination),
      text(row.notes),
    ]))
    .sort((a, b) => {
      const dayCmp = a[0].localeCompare(b[0]);
      return dayCmp || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]);
    });
  const result = await writeSheetRange('schedule', 'A1', [header, ...data]);
  return { ok: true, count: data.length, result };
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildScheduleRows(posts, outboxRows) {
  const postRows = posts.map((post) => ({
    date: toUtcDate(post.updated_at || post.created_at),
    time_utc: toUtcTime(post.updated_at || post.created_at),
    type: post.kind || 'post',
    title: `${post.kind || 'post'} ${post.post_id}`.trim(),
    status: post.status,
    destination: post.publish_chat_id || post.admin_chat_id || 'telegram_admin',
    notes: preview(post.draft_text || post.request_text || post.metadata || '', 100),
  }));

  const outboxScheduleRows = outboxRows.map((row) => ({
    date: toUtcDate(row.scheduled_at),
    time_utc: toUtcTime(row.scheduled_at),
    type: 'outbox',
    title: preview(row.content_text || row.post_id || 'message', 60),
    status: row.status,
    destination: row.destination_type,
    notes: `post_id=${row.post_id || ''} · ${preview(row.dedupe_key || row.correlation_id || '', 60)}`,
  }));

  return [...outboxScheduleRows, ...postRows];
}

export async function syncAllFromDb(database = db, { days = 31 } = {}) {
  const now = new Date();
  const upper = new Date(now.getTime() + Math.max(1, Number(days) || 31) * 86400000).toISOString();
  const lower = startOfUtcDay(now).toISOString();

  const events = database.prepare(`
    SELECT event_key, title, currency, country_code, event_time_utc, importance, forecast, previous, actual
    FROM events
    WHERE event_time_utc >= ? AND event_time_utc < ?
      AND COALESCE(NULLIF(TRIM(title), ''), '') <> 'Event'
    ORDER BY event_time_utc ASC
  `).all(lower, upper);

  const outboxRows = database.prepare(`
    SELECT id, dedupe_key, destination_type, destination_id, content_text, status, scheduled_at, post_id, correlation_id
    FROM outbox
    WHERE status IN ('pending', 'scheduled', 'failed')
    ORDER BY scheduled_at ASC, id ASC
  `).all();

  const posts = database.prepare(`
    SELECT post_id, version, kind, status, draft_text, request_text, admin_chat_id, publish_chat_id, created_at, updated_at, metadata
    FROM posts
    WHERE status IN ('drafted', 'approved')
      AND datetime(created_at) >= datetime('now', '-31 days')
    ORDER BY updated_at DESC, created_at DESC, post_id ASC, version DESC
  `).all();

  if (!getSheetId()) {
    return {
      ok: true,
      counts: {
        events: events.length,
        pipeline: events.length,
        schedule: outboxRows.length + posts.length,
      },
      sheetUrl: '',
      sheet: { ok: false, skipped: true, reason: 'missing_sheet_id' },
      sheetError: '',
      events,
      outbox: outboxRows,
      posts,
    };
  }

  let sheet = { ok: false, skipped: true };
  let sheetError = '';
  try {
    const eventsSync = await syncEventsTab(events);
    const pipelineSync = await syncPipelineTab(events);
    const scheduleSync = await syncScheduleTab(buildScheduleRows(posts, outboxRows));
    sheet = {
      ok: true,
      events: eventsSync,
      pipeline: pipelineSync,
      schedule: scheduleSync,
    };
  } catch (err) {
    sheetError = err?.message || String(err);
  }

  return {
    ok: true,
    counts: {
      events: events.length,
      pipeline: events.length,
      schedule: outboxRows.length + posts.length,
    },
    sheetUrl: sheetUrl(),
    sheet,
    sheetError,
    events,
    outbox: outboxRows,
    posts,
  };
}
