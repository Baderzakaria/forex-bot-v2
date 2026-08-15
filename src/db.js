import Database from 'better-sqlite3';
import config from './config.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

mkdirSync(dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    post_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    kind TEXT DEFAULT 'daily',
    status TEXT DEFAULT 'drafted',
    requested_by TEXT DEFAULT '',
    admin_chat_id TEXT DEFAULT '',
    request_text TEXT DEFAULT '',
    draft_text TEXT DEFAULT '',
    llm_model TEXT DEFAULT 'template',
    metadata TEXT DEFAULT '{}',
    publish_chat_id TEXT DEFAULT '',
    publish_message_id TEXT DEFAULT '',
    lock_version INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (post_id, version)
  );

  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupe_key TEXT UNIQUE,
    destination_type TEXT NOT NULL,
    destination_id TEXT NOT NULL,
    content_text TEXT NOT NULL,
    parse_mode TEXT,
    reply_markup TEXT,
    status TEXT DEFAULT 'pending',
    scheduled_at TEXT DEFAULT (datetime('now')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    post_id TEXT DEFAULT '',
    content_version INTEGER,
    correlation_id TEXT,
    created_by TEXT DEFAULT '',
    remote_message_id TEXT DEFAULT '',
    last_error TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS approval_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    post_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    action_scope TEXT NOT NULL,
    consumed_at TEXT,
    consumed_by TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    event_key TEXT PRIMARY KEY,
    title TEXT,
    currency TEXT,
    country_code TEXT,
    event_time_utc TEXT,
    importance TEXT,
    forecast TEXT,
    previous TEXT,
    actual TEXT,
    source TEXT DEFAULT 'apify',
    captured_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS event_alert_state (
    event_key TEXT PRIMARY KEY,
    last_actual TEXT DEFAULT '',
    actual_first_seen_at TEXT,
    actual_posted_at TEXT,
    actual_apify_requested_at TEXT,
    actual_apify_fetched_at TEXT,
    actual_apify_request_scope TEXT,
    t0_posted_at TEXT,
    refreshed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT,
    version INTEGER,
    action TEXT,
    actor_user_id TEXT,
    actor_username TEXT,
    admin_chat_id TEXT,
    callback_data TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS processed_updates (
    update_id INTEGER PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    telegram_username TEXT NOT NULL DEFAULT '',
    website_customer_code TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
  CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
  CREATE INDEX IF NOT EXISTS idx_events_time ON events(event_time_utc);
  CREATE INDEX IF NOT EXISTS idx_tokens_token ON approval_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_event_alert_state_refresh ON event_alert_state(refreshed_at);
  CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
  CREATE INDEX IF NOT EXISTS idx_members_website_customer_code ON members(website_customer_code);
`);

for (const sql of [
  `ALTER TABLE event_alert_state ADD COLUMN actual_apify_requested_at TEXT`,
  `ALTER TABLE event_alert_state ADD COLUMN actual_apify_fetched_at TEXT`,
  `ALTER TABLE event_alert_state ADD COLUMN actual_apify_request_scope TEXT`,
]) {
  try {
    db.exec(sql);
  } catch (err) {
    if (!String(err?.message || '').toLowerCase().includes('duplicate column name')) {
      throw err;
    }
  }
}

// Seed default settings
const seedSettings = db.prepare(`
  INSERT INTO settings (key, value, updated_at)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
`);
seedSettings.run('post_to_writing_on_approve', 'true');
seedSettings.run('daily_quote_enabled', 'true');
seedSettings.run('daily_hadith_enabled', 'false');
seedSettings.run('daily_quote_mode', 'ai');
seedSettings.run('daily_hadith_mode', 'random');
seedSettings.run('publishing_paused', 'false');

export default db;
