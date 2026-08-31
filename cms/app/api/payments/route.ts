import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CMS_SESSION_COOKIE, getAuthenticatedSession } from "@/lib/auth";
import { timingSafeStringEqual } from "@/lib/auth-session";
import { getEnv } from "@/lib/env";
import { listPayments, PaymentMemberIdentityConflictError, type PaymentInput, type PaymentMethod, type PaymentStatus, upsertPayment } from "@/lib/payments";

export const runtime = "nodejs";
type PaymentsWebhookBody = { website_payment_id?: unknown; email?: unknown; website_customer_code?: unknown; amount?: unknown; currency?: unknown; plan?: unknown; method?: unknown; status?: unknown; paypal_order_id?: unknown };
function getWebhookSecret() { return getEnv("FOREXIS_WEBHOOK_SECRET").trim() || getEnv("FOREX_CMS_WEBHOOK_SECRET").trim(); }
function readRequiredString(value: unknown, field: string, maxLength = 500) { if (typeof value !== "string") throw new Error(`${field} must be a string.`); const normalized = value.trim(); if (!normalized) throw new Error(`${field} must not be empty.`); if (normalized.length > maxLength) throw new Error(`${field} is too long.`); return normalized; }
function readOptionalString(value: unknown, field: string, maxLength = 500) { if (value === undefined || value === null) return undefined; return readRequiredString(value, field, maxLength); }
function validateBody(body: PaymentsWebhookBody): PaymentInput {
  const email = readOptionalString(body.email, "email", 320)?.toLowerCase();
  if (email && (!email.includes("@") || email.length > 320)) throw new Error("email must be a valid email address.");
  const websiteCustomerCode = readOptionalString(body.website_customer_code, "website_customer_code");
  if (!email && !websiteCustomerCode) throw new Error("Provide email or website_customer_code.");
  const amount = readRequiredString(String(body.amount ?? ""), "amount", 64);
  if (!/^\d+(?:\.\d{1,8})?$/.test(amount)) throw new Error("amount must be a positive decimal value.");
  const currency = readRequiredString(body.currency, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a three-letter currency code.");
  const method = readRequiredString(body.method, "method", 32);
  if (method !== "paypal" && method !== "card" && method !== "manual") throw new Error("method must be paypal, card, or manual.");
  const status = readRequiredString(body.status, "status", 32);
  if (!(["pending", "paid", "failed", "refunded"] as string[]).includes(status)) throw new Error("status must be pending, paid, failed, or refunded.");
  return { websitePaymentId: readRequiredString(body.website_payment_id, "website_payment_id"), email, websiteCustomerCode, amount, currency, plan: readOptionalString(body.plan, "plan") ?? "", method: method as PaymentMethod, status: status as PaymentStatus, paypalOrderId: readOptionalString(body.paypal_order_id, "paypal_order_id") };
}
export async function GET() { const cookieStore = await cookies(); const session = getAuthenticatedSession(cookieStore.get(CMS_SESSION_COOKIE)?.value); if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }); return NextResponse.json({ ok: true, payments: listPayments() }); }
export async function POST(request: Request) {
  const configuredSecret = getWebhookSecret(); const requestSecret = request.headers.get("X-Forexis-Webhook-Secret") || "";
  if (!configuredSecret || !timingSafeStringEqual(requestSecret, configuredSecret)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let body: PaymentsWebhookBody; try { body = (await request.json()) as PaymentsWebhookBody; } catch { return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "Expected a JSON object." }, { status: 400 });
  let input: PaymentInput; try { input = validateBody(body); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid payment payload." }, { status: 400 }); }
  try { const result = upsertPayment(input); return NextResponse.json({ ok: true, action: result.action, payment: { website_payment_id: result.payment.website_payment_id } }, { status: result.action === "created" ? 201 : 200 }); } catch (error) { if (error instanceof PaymentMemberIdentityConflictError) return NextResponse.json({ ok: false, error: error.message }, { status: 409 }); return NextResponse.json({ ok: false, error: "Unable to save payment." }, { status: 500 }); }
}
