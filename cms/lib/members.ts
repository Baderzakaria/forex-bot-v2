import "server-only";

import { randomBytes } from "node:crypto";

import { getBotDb } from "@/lib/bot-db";

export type MemberStatus = "pending" | "active";

export type MemberInput = {
  email?: string;
  telegramUsername?: string;
  websiteCustomerCode?: string;
  plan?: string;
  status?: MemberStatus;
};

export type MemberRow = {
  id: number;
  email: string | null;
  telegram_username: string;
  website_customer_code: string | null;
  plan: string;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
};

export class MemberIdentityConflictError extends Error {
  constructor() {
    super("The supplied email and website customer code belong to different members.");
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
    CREATE INDEX IF NOT EXISTS idx_members_website_customer_code ON members(website_customer_code);
  `);
  return db;
}

export function listMembers() {
  return getMembersDb()
    .prepare("SELECT * FROM members ORDER BY datetime(created_at) DESC, id DESC")
    .all() as MemberRow[];
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
        INSERT INTO members (email, telegram_username, website_customer_code, plan, status)
        VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(
        input.email ?? null,
        input.telegramUsername ?? "",
        websiteCustomerCode,
        input.plan ?? "",
        input.status ?? "pending"
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
