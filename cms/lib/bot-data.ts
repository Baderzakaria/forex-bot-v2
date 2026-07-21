import "server-only";

import { getBotDb, hasBotDatabase } from "@/lib/bot-db";
import { formatDateTime } from "@/lib/format";

export type EventRow = {
  event_key: string;
  title: string | null;
  currency: string | null;
  country_code: string | null;
  event_time_utc: string | null;
  importance: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  source: string | null;
  captured_at: string | null;
};

export type PostRow = {
  post_id: string;
  version: number;
  kind: string | null;
  status: string | null;
  requested_by: string | null;
  admin_chat_id: string | null;
  request_text: string | null;
  draft_text: string | null;
  llm_model: string | null;
  metadata: string | null;
  publish_chat_id: string | null;
  publish_message_id: string | null;
  lock_version: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type OutboxRow = {
  id: number;
  dedupe_key: string | null;
  destination_type: string | null;
  destination_id: string | null;
  content_text: string | null;
  parse_mode: string | null;
  reply_markup: string | null;
  status: string | null;
  scheduled_at: string | null;
  attempts: number | null;
  max_attempts: number | null;
  post_id: string | null;
  content_version: number | null;
  created_by: string | null;
  remote_message_id: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type BotHealth = {
  source: "proxy" | "local";
  ok: boolean;
  dbPresent: boolean;
  now: string;
  counts: {
    events: number;
    posts: number;
    outbox: number;
    pendingOutbox: number;
  };
  botApiUrl?: string;
  message?: string;
};

type SettingsMap = Record<string, string>;

function readSettingsMap(): SettingsMap {
  if (!hasBotDatabase()) return {};
  const rows = getBotDb(true)
    .prepare("select key, value from settings order by key asc")
    .all() as Array<{ key: string; value: string | null }>;
  return rows.reduce<SettingsMap>((acc, row) => {
    acc[row.key] = row.value ?? "";
    return acc;
  }, {});
}

export function getSettingsView() {
  const settings = readSettingsMap();
  const publishingPaused = settings.publishing_paused || settings.pause_mode || "false";

  return {
    sheetUrl: settings.google_sheet_url || settings.google_sheet_id || "",
    countries: settings.apify_macro_countries || "",
    daysAhead: settings.apify_macro_days_ahead || "",
    botApiUrl: settings.bot_api_url || "",
    cron: settings.cron_schedule || "",
    pauseMode: publishingPaused,
    publishingPaused,
    postToWritingOnApprove: settings.post_to_writing_on_approve || "true",
    dailyQuoteEnabled: settings.daily_quote_enabled || "true",
    dailyHadithEnabled: settings.daily_hadith_enabled || "false",
    dailyQuoteMode: settings.daily_quote_mode || "ai",
    dailyHadithMode: settings.daily_hadith_mode || "random",
    telegramAdminChatId: settings.telegram_admin_chat_id || "",
    telegramPublicChatId: settings.telegram_public_chat_id || "",
    telegramWritingChatId: settings.telegram_writing_chat_id || "",
  };
}

export function listEvents() {
  if (!hasBotDatabase()) return [] as EventRow[];
  return getBotDb(true)
    .prepare(
      "select * from events order by datetime(event_time_utc) asc, captured_at desc"
    )
    .all() as EventRow[];
}

export function listLatestPosts(limit = 12) {
  if (!hasBotDatabase()) return [] as PostRow[];
  return getBotDb(true)
    .prepare(
      `
      with ranked as (
        select p.*, row_number() over (partition by post_id order by version desc, datetime(updated_at) desc) as rn
        from posts p
      )
      select * from ranked where rn = 1 order by datetime(updated_at) desc limit ?
    `
    )
    .all(limit) as PostRow[];
}

export function listAllLatestPosts() {
  if (!hasBotDatabase()) return [] as PostRow[];
  return getBotDb(true)
    .prepare(
      `
      with ranked as (
        select p.*, row_number() over (partition by post_id order by version desc, datetime(updated_at) desc) as rn
        from posts p
      )
      select * from ranked where rn = 1 order by datetime(updated_at) desc
    `
    )
    .all() as PostRow[];
}

export function getPostById(postId: string) {
  if (!hasBotDatabase()) return null;
  return (
    getBotDb(true)
      .prepare(
        "select * from posts where post_id = ? order by version desc limit 1"
      )
      .get(postId) as PostRow | undefined
  );
}

export function listOutbox(limit = 15) {
  if (!hasBotDatabase()) return [] as OutboxRow[];
  return getBotDb(true)
    .prepare("select * from outbox order by datetime(updated_at) desc, id desc limit ?")
    .all(limit) as OutboxRow[];
}

export function listUpcomingEvents(limit = 8) {
  const now = Date.now();
  return listEvents()
    .filter((event) => {
      const time = event.event_time_utc ? new Date(event.event_time_utc).getTime() : 0;
      return time >= now;
    })
    .slice(0, limit);
}

export function listPreviousEvents(limit = 8) {
  const now = Date.now();
  return listEvents()
    .filter((event) => {
      const time = event.event_time_utc ? new Date(event.event_time_utc).getTime() : 0;
      return time < now;
    })
    .slice(0, limit);
}

export function getBotHealth(): BotHealth {
  const dbPresent = hasBotDatabase();
  const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "http://127.0.0.1:8788";

  if (!dbPresent) {
    return {
      source: "local",
      ok: false,
      dbPresent,
      now: new Date().toISOString(),
      counts: { events: 0, posts: 0, outbox: 0, pendingOutbox: 0 },
      botApiUrl,
      message: "SQLite database is missing.",
    };
  }

  const db = getBotDb(true);
  const counts = {
    events: db.prepare("select count(*) as count from events").get() as { count: number },
    posts: db.prepare("select count(*) as count from posts").get() as { count: number },
    outbox: db.prepare("select count(*) as count from outbox").get() as { count: number },
    pendingOutbox: db
      .prepare("select count(*) as count from outbox where coalesce(status, '') = 'pending'")
      .get() as { count: number },
  };

  return {
    source: "local",
    ok: true,
    dbPresent,
    now: new Date().toISOString(),
    counts: {
      events: counts.events.count,
      posts: counts.posts.count,
      outbox: counts.outbox.count,
      pendingOutbox: counts.pendingOutbox.count,
    },
    botApiUrl,
  };
}

export function summarizeEvent(event: EventRow) {
  return {
    ...event,
    timeLabel: formatDateTime(event.event_time_utc),
  };
}

export function upsertSetting(key: string, value: string) {
  const db = getBotDb(false);
  db.prepare(
    `
    insert into settings (key, value, updated_at)
    values (?, ?, datetime('now'))
    on conflict(key) do update set
      value = excluded.value,
      updated_at = excluded.updated_at
  `
  ).run(key, value);
}

export function updatePostDraft(postId: string, input: {
  draftText?: string;
  status?: string;
  metadata?: string;
}) {
  const db = getBotDb(false);
  const current = getPostById(postId);
  if (!current) return null;

  db.prepare(
    `
    update posts
    set
      draft_text = coalesce(?, draft_text),
      status = coalesce(?, status),
      metadata = coalesce(?, metadata),
      lock_version = coalesce(lock_version, 1) + 1,
      updated_at = datetime('now')
    where post_id = ? and version = ?
  `
  ).run(input.draftText ?? null, input.status ?? null, input.metadata ?? null, postId, current.version);

  return getPostById(postId);
}
