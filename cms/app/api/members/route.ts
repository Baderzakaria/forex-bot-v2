import { NextResponse } from "next/server";

import { timingSafeStringEqual } from "@/lib/auth-session";
import { getEnv } from "@/lib/env";
import { MemberIdentityConflictError, type MemberStatus, upsertMember } from "@/lib/members";

export const runtime = "nodejs";

type MembersWebhookBody = {
  email?: unknown;
  telegram_username?: unknown;
  website_customer_code?: unknown;
  plan?: unknown;
  status?: unknown;
};

function getWebhookSecret() {
  return getEnv("FOREXIS_WEBHOOK_SECRET").trim() || getEnv("FOREX_CMS_WEBHOOK_SECRET").trim();
}

function readOptionalString(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);

  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must not be empty.`);
  if (normalized.length > 500) throw new Error(`${field} is too long.`);
  return normalized;
}

/** Telegram is optional on website checkout; accept null/empty as omitted. */
function readOptionalTelegramUsername(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("telegram_username must be a string.");

  const normalized = value.trim().replace(/^@/, "");
  if (!normalized) return undefined;
  if (normalized.length > 500) throw new Error("telegram_username is too long.");
  return normalized;
}

function validateBody(body: MembersWebhookBody) {
  const email = readOptionalString(body.email, "email")?.toLowerCase();
  if (email && (!email.includes("@") || email.length > 320)) {
    throw new Error("email must be a valid email address.");
  }

  const websiteCustomerCode = readOptionalString(body.website_customer_code, "website_customer_code");
  if (!email && !websiteCustomerCode) {
    throw new Error("Provide email or website_customer_code.");
  }

  const status = body.status === undefined ? undefined : readOptionalString(body.status, "status");
  if (status !== undefined && status !== "pending" && status !== "active") {
    throw new Error("status must be pending or active.");
  }

  return {
    email,
    telegramUsername: readOptionalTelegramUsername(body.telegram_username),
    websiteCustomerCode,
    plan: readOptionalString(body.plan, "plan"),
    status: status as MemberStatus | undefined,
  };
}

export async function POST(request: Request) {
  const configuredSecret = getWebhookSecret();
  const requestSecret = request.headers.get("X-Forexis-Webhook-Secret") || "";
  if (!configuredSecret || !timingSafeStringEqual(requestSecret, configuredSecret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: MembersWebhookBody;
  try {
    body = (await request.json()) as MembersWebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Expected a JSON object." }, { status: 400 });
  }

  let input;
  try {
    input = validateBody(body);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid member payload." },
      { status: 400 }
    );
  }

  try {
    const result = upsertMember(input);
    return NextResponse.json(
      {
        ok: true,
        action: result.action,
        member: {
          email: result.member.email,
          website_customer_code: result.member.website_customer_code,
          status: result.member.status,
        },
      },
      { status: result.action === "created" ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof MemberIdentityConflictError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }

    return NextResponse.json({ ok: false, error: "Unable to save member." }, { status: 500 });
  }
}
