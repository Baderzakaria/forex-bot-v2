import "server-only";

import { randomBytes } from "node:crypto";

import { getBotDb } from "@/lib/bot-db";

export type MemberStatus = "pending" | "active";
export type MemberSource = "webhook" | "manual";

export type MemberInput = {
  email?: string;
  telegramUsername?: string;
  websiteCustomerCode?: string;
  plan?: string;
  status?: MemberStatus;
  comments?: string;
  source?: MemberSource;
};

export type MemberUpdateInput = {
  email?: unknown;
  telegramUsername?: unknown;
  websiteCustomerCode?: unknown;
  plan?: unknown;
  status?: unknown;
  comments?: unknown;
};

export type MemberRow = {
  id: number;
  email: string | null;
  telegram_username: string;
  website_customer_code: string | null;
  plan: string;
  status: MemberStatus;
  comments: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberPage = {
  members: MemberRow[];
  total: number;
  page: number;
  limit: number;
};

export class MemberIdentityConflictError extends Error {
  constructor() {
    super("The supplied email and website customer code belong to different members.");
  }
}

export class MemberFieldConflictError extends Error {
  constructor(field: "email" | "website_customer_code") {
    super(`Another member already uses this ${field === "email" ? "email address" : "website customer code"}.`);
  }
}

export class MemberNotFoundError extends Error {
  constructor() {
    super("Member not found.");
  }
}

function getMembersDb() {
  const db = getBotDb(false);
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      telegram_username TEXT NOT NULL DEFAULT '',
      website_customer_code TEXT UNIQUE,
      plan TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
      comments TEXT,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
    CREATE INDEX IF NOT EXISTS idx_members_website_customer_code ON members(website_customer_code);
  `);

  for (const sql of [
    "ALTER TABLE members ADD COLUMN comments TEXT",
    "ALTER TABLE members ADD COLUMN source TEXT",
  ]) {
    try {
      db.exec(sql);
    } catch (error) {
      if (!String(error instanceof Error ? error.message : error).toLowerCase().includes("duplicate column name")) {
        throw error;
      }
    }
  }

  return db;
}

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function listMembers(options: { page?: number; limit?: number } = {}): MemberPage {
  const db = getMembersDb();
  const limit = positiveInteger(options.limit, 20, 100);
  const requestedPage = positiveInteger(options.page, 1, 1_000_000);
  const total = (db.prepare("SELECT COUNT(*) AS count FROM members").get() as { count: number }).count;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const members = db
    .prepare("SELECT * FROM members ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?")
    .all(limit, (page - 1) * limit) as MemberRow[];

  return { members, total, page, limit };
}

function findMatchingMembers(input: MemberInput) {
  const clauses: string[] = [];
  const values: string[] = [];

  if (input.email) {
    clauses.push("email = ?");
    values.push(input.email);
  }
  if (input.websiteCustomerCode) {
    clauses.push("website_customer_code = ?");
    values.push(input.websiteCustomerCode);
  }

  return getMembersDb()
    .prepare(`SELECT * FROM members WHERE ${clauses.join(" OR ")}`)
    .all(...values) as MemberRow[];
}

function generateWebsiteCustomerCode() {
  return `FXIS-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function generateAvailableWebsiteCustomerCode(db: ReturnType<typeof getMembersDb>) {
  const findByCode = db.prepare("SELECT 1 FROM members WHERE website_customer_code = ?");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateWebsiteCustomerCode();
    if (!findByCode.get(code)) return code;
  }

  throw new Error("Unable to generate a unique website customer code.");
}

export function upsertMember(input: MemberInput) {
  const matches = findMatchingMembers(input);
  if (matches.length > 1) throw new MemberIdentityConflictError();

  const db = getMembersDb();
  const existing = matches[0];

  if (!existing) {
    const websiteCustomerCode = input.websiteCustomerCode ?? generateAvailableWebsiteCustomerCode(db);
    const info = db
      .prepare(
        `
        INSERT INTO members (email, telegram_username, website_customer_code, plan, status, comments, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        input.email ?? null,
        input.telegramUsername ?? "",
        websiteCustomerCode,
        input.plan ?? "",
        input.status ?? "pending",
        input.comments ?? null,
        input.source ?? null
      );

    const member = db.prepare("SELECT * FROM members WHERE id = ?").get(info.lastInsertRowid) as MemberRow;
    return { action: "created" as const, member };
  }

  const updates: string[] = [];
  const values: Array<string | MemberStatus> = [];
  const addUpdate = (column: string, value: string | MemberStatus | undefined) => {
    if (value === undefined) return;
    updates.push(`${column} = ?`);
    values.push(value);
  };

  addUpdate("email", input.email);
  addUpdate("telegram_username", input.telegramUsername);
  addUpdate("website_customer_code", input.websiteCustomerCode);
  addUpdate("plan", input.plan);
  addUpdate("status", input.status);
  updates.push("updated_at = datetime('now')");

  db.prepare(`UPDATE members SET ${updates.join(", ")} WHERE id = ?`).run(...values, existing.id);
  const member = db.prepare("SELECT * FROM members WHERE id = ?").get(existing.id) as MemberRow;
  return { action: "updated" as const, member };
}

function optionalText(value: unknown, field: string, maximum: number, options: { nullable?: boolean; stripTelegramAt?: boolean } = {}) {
  if (value === undefined) return undefined;
  if (value === null && options.nullable) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);

  const normalized = value.trim().replace(options.stripTelegramAt ? /^@/ : "", "");
  if (normalized.length > maximum) throw new Error(`${field} is too long.`);
  return normalized || (options.nullable ? null : "");
}

export function updateMember(id: number, input: MemberUpdateInput) {
  if (!Number.isSafeInteger(id) || id < 1) throw new MemberNotFoundError();

  const email = optionalText(input.email, "email", 320, { nullable: true });
  if (typeof email === "string" && !email.includes("@")) {
    throw new Error("email must be a valid email address.");
  }

  const telegramUsername = optionalText(input.telegramUsername, "telegram_username", 500, {
    stripTelegramAt: true,
  });
  const websiteCustomerCode = optionalText(input.websiteCustomerCode, "website_customer_code", 500);
  if (websiteCustomerCode === "") {
    throw new Error("website_customer_code must not be empty once assigned.");
  }
  const plan = optionalText(input.plan, "plan", 500);
  const comments = optionalText(input.comments, "comments", 10_000, { nullable: true });

  let status: MemberStatus | undefined;
  if (input.status !== undefined) {
    if (input.status !== "pending" && input.status !== "active") {
      throw new Error("status must be pending or active.");
    }
    status = input.status;
  }

  const updates: Array<[string, string | null | MemberStatus]> = [];
  if (email !== undefined) updates.push(["email", typeof email === "string" ? email.toLowerCase() : email]);
  if (telegramUsername !== undefined) updates.push(["telegram_username", telegramUsername]);
  if (websiteCustomerCode !== undefined) updates.push(["website_customer_code", websiteCustomerCode]);
  if (plan !== undefined) updates.push(["plan", plan]);
  if (status !== undefined) updates.push(["status", status]);
  if (comments !== undefined) updates.push(["comments", comments]);
  if (!updates.length) throw new Error("Provide at least one member field to update.");

  const db = getMembersDb();
  const existing = db.prepare("SELECT * FROM members WHERE id = ?").get(id) as MemberRow | undefined;
  if (!existing) throw new MemberNotFoundError();

  for (const [column, value] of updates) {
    if (value === null || (column !== "email" && column !== "website_customer_code")) continue;
    const duplicate = db.prepare(`SELECT id FROM members WHERE ${column} = ? AND id != ?`).get(value, id);
    if (duplicate) {
      throw new MemberFieldConflictError(column as "email" | "website_customer_code");
    }
  }

  const assignments = updates.map(([column]) => `${column} = ?`);
  db.prepare(`UPDATE members SET ${assignments.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(
    ...updates.map(([, value]) => value),
    id
  );

  return db.prepare("SELECT * FROM members WHERE id = ?").get(id) as MemberRow;
}
