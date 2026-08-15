import "server-only";

import { getBotDb } from "@/lib/bot-db";

export type PaymentMethod = "paypal" | "card" | "manual";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type PaymentInput = {
  websitePaymentId: string;
  email?: string;
  websiteCustomerCode?: string;
  amount: string;
  currency: string;
  plan: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paypalOrderId?: string;
};

export type PaymentRow = {
  id: number;
  website_payment_id: string;
  member_id: number | null;
  member_email: string | null;
  website_customer_code: string | null;
  amount: string;
  currency: string;
  plan: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paypal_order_id: string | null;
  created_at: string;
  updated_at: string;
};

export class PaymentMemberIdentityConflictError extends Error {
  constructor() {
    super("The supplied email and website customer code belong to different members.");
  }
}

function getPaymentsDb() {
  const db = getBotDb(false);
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      website_payment_id TEXT NOT NULL UNIQUE,
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      member_email TEXT,
      website_customer_code TEXT,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT '',
      method TEXT NOT NULL CHECK (method IN ('paypal', 'card', 'manual')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
      paypal_order_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);
    CREATE INDEX IF NOT EXISTS idx_payments_member_email ON payments(member_email);
    CREATE INDEX IF NOT EXISTS idx_payments_website_customer_code ON payments(website_customer_code);
    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
  `);
  return db;
}

export function listPayments() {
  return getPaymentsDb().prepare("SELECT * FROM payments ORDER BY datetime(created_at) DESC, id DESC").all() as PaymentRow[];
}

function findMember(input: Pick<PaymentInput, "email" | "websiteCustomerCode">) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (input.email) { clauses.push("email = ?"); values.push(input.email); }
  if (input.websiteCustomerCode) { clauses.push("website_customer_code = ?"); values.push(input.websiteCustomerCode); }
  if (!clauses.length) return undefined;
  const matches = getPaymentsDb().prepare(`SELECT id, email, website_customer_code FROM members WHERE ${clauses.join(" OR ")}`).all(...values) as Array<{ id: number; email: string | null; website_customer_code: string | null }>;
  if (matches.length > 1) throw new PaymentMemberIdentityConflictError();
  return matches[0];
}

export function upsertPayment(input: PaymentInput) {
  const db = getPaymentsDb();
  const member = findMember(input);
  const memberEmail = member?.email ?? input.email ?? null;
  const websiteCustomerCode = member?.website_customer_code ?? input.websiteCustomerCode ?? null;
  const existing = db.prepare("SELECT * FROM payments WHERE website_payment_id = ?").get(input.websitePaymentId) as PaymentRow | undefined;
  if (!existing) {
    const info = db.prepare(`INSERT INTO payments (website_payment_id, member_id, member_email, website_customer_code, amount, currency, plan, method, status, paypal_order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(input.websitePaymentId, member?.id ?? null, memberEmail, websiteCustomerCode, input.amount, input.currency, input.plan, input.method, input.status, input.paypalOrderId ?? null);
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(info.lastInsertRowid) as PaymentRow;
    return { action: "created" as const, payment };
  }
  db.prepare(`UPDATE payments SET member_id = ?, member_email = ?, website_customer_code = ?, amount = ?, currency = ?, plan = ?, method = ?, status = ?, paypal_order_id = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(member?.id ?? existing.member_id, memberEmail ?? existing.member_email, websiteCustomerCode ?? existing.website_customer_code, input.amount, input.currency, input.plan, input.method, input.status, input.paypalOrderId ?? existing.paypal_order_id, existing.id);
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(existing.id) as PaymentRow;
  return { action: "updated" as const, payment };
}
