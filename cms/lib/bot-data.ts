import "server-only";

import crypto from "node:crypto";

import { getBotDb, hasBotDatabase } from "@/lib/bot-db";
import { formatDateTimeUtc } from "@/lib/format";
import type { EventAlertMeta, EventAlertStageMeta } from "@/lib/events";

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

type AlertStateRow = {
  event_key: string;
  last_actual: string | null;
  actual_first_seen_at: string | null;
  actual_posted_at: string | null;
  t0_posted_at: string | null;
  refreshed_at: string | null;
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
    socialXHandle: settings.social_x_handle || "",
    socialXEnabled: settings.social_x_enabled || "false",
    socialLinkedInHandle: settings.social_linkedin_handle || "",
    socialLinkedInEnabled: settings.social_linkedin_enabled || "false",
    socialInstagramHandle: settings.social_instagram_handle || "",
    socialInstagramEnabled: settings.social_instagram_enabled || "false",
  };
}

export function listEvents() {
  if (!hasBotDatabase()) return [] as EventRow[];
  return getBotDb(true)
    .prepare(
      `select * from events
       where coalesce(nullif(trim(title), ''), '') <> ''
         and coalesce(nullif(trim(title), ''), '') <> 'Event'
       order by datetime(event_time_utc) asc, captured_at desc`
    )
    .all() as EventRow[];
}

function getPreAlertMinutes(settings: SettingsMap) {
  const candidates = [
    settings.pre_alert_minutes,
    settings.PRE_ALERT_MINUTES,
    process.env.PRE_ALERT_MINUTES,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }

  return 30;
}

function placeholders(count: number) {
  return Array.from({ length: count }, () => "?").join(", ");
}

function asLatestPostMap(rows: PostRow[]) {
  return rows.reduce<Record<string, PostRow>>((acc, row) => {
    acc[row.post_id] = row;
    return acc;
  }, {});
}

function asSentOutboxMap(rows: Array<{ post_id: string | null }>) {
  return rows.reduce<Record<string, true>>((acc, row) => {
    if (row.post_id) {
      acc[row.post_id] = true;
    }
    return acc;
  }, {});
}

function asAlertStateMap(rows: AlertStateRow[]) {
  return rows.reduce<Record<string, AlertStateRow>>((acc, row) => {
    acc[row.event_key] = row;
    return acc;
  }, {});
}

function buildStageMeta(input: {
  fireAtMs: number | null;
  nowMs: number;
  hasSent: boolean;
  lateStatus: "missed" | "past";
}): EventAlertStageMeta {
  const { fireAtMs, nowMs, hasSent, lateStatus } = input;

  if (hasSent) {
    return { status: "sent", atLabel: "sent" };
  }

  if (!Number.isFinite(fireAtMs ?? NaN)) {
    return { status: "none", atLabel: "—" };
  }

  const fireAt = fireAtMs as number;
  const diffMs = fireAt - nowMs;
  const absMs = Math.abs(diffMs);

  if (absMs <= 60_000) {
    return { status: "due", atLabel: "due", mins: 1 };
  }

  const mins = Math.max(1, Math.ceil(absMs / 60_000));
  if (diffMs > 0) {
    return { status: "upcoming", atLabel: "upcoming", mins };
  }

  return { status: lateStatus, atLabel: lateStatus, mins };
}

function isPublishedPost(row?: PostRow) {
  if (!row) return false;
  return row.status === "published" || Boolean(row.publish_message_id?.trim());
}

export function getEventAlertMeta(eventKeys: string[], now: string | Date = new Date()): Record<string, EventAlertMeta> {
  if (!hasBotDatabase()) return {};

  const uniqueEventKeys = Array.from(
    new Set(eventKeys.map((key) => String(key || "").trim()).filter(Boolean))
  );
  if (!uniqueEventKeys.length) return {};

  const settings = readSettingsMap();
  const preAlertMinutes = getPreAlertMinutes(settings);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return {};

  const db = getBotDb(true);
  const postIds = uniqueEventKeys.flatMap((eventKey) => [`t30-${eventKey}`, `t0-${eventKey}`, `actual-${eventKey}`]);
  const postPlaceholders = placeholders(postIds.length);
  const eventPlaceholders = placeholders(uniqueEventKeys.length);

  const latestPosts = postIds.length
    ? (db
        .prepare(
          `
          with ranked as (
            select p.*, row_number() over (
              partition by post_id
              order by version desc, datetime(updated_at) desc
            ) as rn
            from posts p
            where p.post_id in (${postPlaceholders})
          )
          select * from ranked where rn = 1
        `
        )
        .all(...postIds) as PostRow[])
    : [];

  const sentOutboxRows = postIds.length
    ? (db
        .prepare(
          `
          select distinct post_id
          from outbox
          where post_id in (${postPlaceholders})
            and coalesce(status, '') = 'sent'
        `
        )
        .all(...postIds) as Array<{ post_id: string | null }>)
    : [];

  const alertStates = uniqueEventKeys.length
    ? (db
        .prepare(
          `
          select event_key, last_actual, actual_first_seen_at, actual_posted_at, t0_posted_at, refreshed_at
          from event_alert_state
          where event_key in (${eventPlaceholders})
        `
        )
        .all(...uniqueEventKeys) as AlertStateRow[])
    : [];

  const eventRows = db
    .prepare(
      `
      select event_key, event_time_utc
      from events
      where event_key in (${eventPlaceholders})
    `
    )
    .all(...uniqueEventKeys) as Array<{ event_key: string; event_time_utc: string | null }>;

  const latestPostMap = asLatestPostMap(latestPosts);
  const sentOutboxMap = asSentOutboxMap(sentOutboxRows);
  const alertStateMap = asAlertStateMap(alertStates);
  const eventTimeMap = eventRows.reduce<Record<string, string | null>>((acc, row) => {
    acc[row.event_key] = row.event_time_utc;
    return acc;
  }, {});

  return uniqueEventKeys.reduce<Record<string, EventAlertMeta>>((acc, eventKey) => {
    const eventMs = eventTimeMap[eventKey] ? new Date(eventTimeMap[eventKey] as string).getTime() : NaN;
    const state = alertStateMap[eventKey];

    const t30PostId = `t30-${eventKey}`;
    const t0PostId = `t0-${eventKey}`;
    const actualPostId = `actual-${eventKey}`;

    const t30Post = latestPostMap[t30PostId];
    const t0Post = latestPostMap[t0PostId];
    const actualPost = latestPostMap[actualPostId];

    const t30 = buildStageMeta({
      fireAtMs: Number.isFinite(eventMs) ? eventMs - preAlertMinutes * 60_000 : null,
      nowMs,
      hasSent: Boolean(sentOutboxMap[t30PostId]) || isPublishedPost(t30Post),
      lateStatus: "missed",
    });
    const t0 = buildStageMeta({
      fireAtMs: Number.isFinite(eventMs) ? eventMs : null,
      nowMs,
      hasSent: Boolean(sentOutboxMap[t0PostId]) || isPublishedPost(t0Post),
      lateStatus: "past",
    });
    const actual = buildStageMeta({
      fireAtMs: Number.isFinite(eventMs) ? eventMs : null,
      nowMs,
      hasSent: Boolean(sentOutboxMap[actualPostId]) || isPublishedPost(actualPost),
      lateStatus: "past",
    });

    const sentAny =
      t30.status === "sent" ||
      t0.status === "sent" ||
      actual.status === "sent" ||
      Boolean(state?.t0_posted_at) ||
      Boolean(state?.actual_posted_at);

    acc[eventKey] = { t30, t0, actual, sentAny };
    return acc;
  }, {});
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

export function listOutboxForPost(postId: string) {
  if (!hasBotDatabase()) return [] as OutboxRow[];
  return getBotDb(true)
    .prepare(
      "select * from outbox where post_id = ? order by datetime(scheduled_at) desc, id desc"
    )
    .all(postId) as OutboxRow[];
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
    timeLabel: formatDateTimeUtc(event.event_time_utc),
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

function normalizeKind(kind?: string | null) {
  const value = String(kind || "manual").toLowerCase();
  if (value === "daily" || value === "macro" || value === "manual") return value;
  return "manual";
}

function makePostId(kind?: string | null) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `cms-${normalizeKind(kind)}-${day}-${suffix}`;
}

function normalizeIso(value?: string | null) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function makeOutboxDedupeKey(input: {
  destinationType: string;
  destinationId: string;
  contentText: string;
  scheduledAt: string;
  postId?: string | null;
  contentVersion?: number | null;
  createdBy?: string | null;
}) {
  const hash = crypto
    .createHash("sha1")
    .update(
      [
        input.destinationType,
        input.destinationId,
        input.postId || "",
        input.contentVersion ?? "",
        input.scheduledAt,
        input.createdBy || "",
        input.contentText,
      ].join("\u0000")
    )
    .digest("hex")
    .slice(0, 16);
  return `cms:${input.destinationType}:${input.postId || "manual"}:${input.contentVersion ?? 0}:${hash}`;
}

export function createPost(input: {
  postId?: string;
  kind?: string;
  draftText?: string;
  requestText?: string;
  status?: string;
}) {
  const db = getBotDb(false);
  const postId = input.postId?.trim() || makePostId(input.kind);
  const kind = normalizeKind(input.kind);
  const requestText = String(input.requestText || "").trim() || String(input.draftText || "").trim() || "cms draft";
  const draftText = String(input.draftText || "").trim() || String(input.requestText || "").trim() || "";
  const status = String(input.status || "").trim() || "drafted";

  db.prepare(
    `
    insert or ignore into posts (
      post_id, version, kind, status, requested_by, admin_chat_id,
      request_text, draft_text, llm_model, metadata
    ) values (?, 1, ?, ?, 'cms', '', ?, ?, 'template', '{}')
  `
  ).run(postId, kind, status, requestText, draftText);

  return getPostById(postId);
}

export function enqueueOutbox(input: {
  destinationType: string;
  destinationId: string;
  contentText: string;
  scheduledAt: string;
  postId?: string | null;
  contentVersion?: number | null;
  createdBy?: string | null;
  parseMode?: string | null;
  replyMarkup?: unknown;
  correlationId?: string | null;
  dedupeKey?: string | null;
}) {
  const db = getBotDb(false);
  const scheduledAt = normalizeIso(input.scheduledAt);
  const dedupeKey =
    input.dedupeKey ||
    makeOutboxDedupeKey({
      destinationType: input.destinationType,
      destinationId: String(input.destinationId),
      contentText: input.contentText,
      scheduledAt,
      postId: input.postId,
      contentVersion: input.contentVersion,
      createdBy: input.createdBy,
    });

  db.prepare(
    `
    insert or ignore into outbox (
      dedupe_key, destination_type, destination_id, content_text, parse_mode, reply_markup,
      status, scheduled_at, attempts, max_attempts, post_id, content_version, correlation_id, created_by
    ) values (?, ?, ?, ?, ?, ?, 'pending', ?, 0, 5, ?, ?, ?, ?)
  `
  ).run(
    dedupeKey,
    input.destinationType,
    String(input.destinationId),
    String(input.contentText || ""),
    input.parseMode || null,
    input.replyMarkup ? JSON.stringify(input.replyMarkup) : null,
    scheduledAt,
    input.postId || "",
    input.contentVersion ?? null,
    input.correlationId || null,
    input.createdBy || ""
  );

  return (
    db.prepare("select * from outbox where dedupe_key = ? limit 1").get(dedupeKey) as OutboxRow | undefined
  ) || null;
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
