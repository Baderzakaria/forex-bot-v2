import db from './db.js';

export function enqueue(row) {
  const dedupeKey = row.dedupe_key || `${row.destination_type}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const info = db.prepare(`
    INSERT OR IGNORE INTO outbox (dedupe_key, destination_type, destination_id, content_text, parse_mode, reply_markup, status, scheduled_at, attempts, max_attempts, post_id, content_version, correlation_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, 5, ?, ?, ?, ?)
  `).run(
    dedupeKey, row.destination_type, String(row.destination_id),
    row.content_text || '', row.parse_mode || null,
    row.reply_markup ? JSON.stringify(row.reply_markup) : null,
    row.scheduled_at || new Date().toISOString(),
    row.post_id || '', row.content_version || null,
    row.correlation_id || null, row.created_by || ''
  );
  return { inserted: info.changes > 0, id: info.lastInsertRowid };
}

export function claimNext() {
  const nowIso = new Date().toISOString();
  const row = db.prepare(`
    SELECT * FROM outbox
    WHERE status IN ('pending', 'scheduled', 'failed')
      AND scheduled_at <= ?
    ORDER BY scheduled_at ASC, id ASC LIMIT 1
  `).get(nowIso);
  if (!row) return null;
  db.prepare(`UPDATE outbox SET status = 'sending', updated_at = datetime('now') WHERE id = ?`).run(row.id);
  if (row.reply_markup) {
    try { row.reply_markup = JSON.parse(row.reply_markup); } catch {}
  }
  return row;
}

export function markSent(id, messageId) {
  db.prepare(`
    UPDATE outbox SET status = 'sent', remote_message_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(String(messageId || ''), id);
}

export function markFailed(id, err, delayMs = 5000) {
  const retryAt = new Date(Date.now() + delayMs).toISOString();
  db.prepare(`
    UPDATE outbox SET
      status = CASE WHEN attempts + 1 >= max_attempts THEN 'dead_letter' ELSE 'failed' END,
      attempts = attempts + 1,
      last_error = ?,
      scheduled_at = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(String(err?.message || err), retryAt, id);
}

export function isPaused() {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'publishing_paused'`).get();
  return row?.value === 'true' || row?.value === true;
}

export function getBoolSetting(key, fallback = false) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  if (!row) return fallback;
  return row.value === 'true' || row.value === true;
}

export function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(key, String(value));
}
