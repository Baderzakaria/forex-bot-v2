import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { CMS_SESSION_COOKIE, getAuthenticatedSession } from "@/lib/auth";
import {
  MemberFieldConflictError,
  MemberNotFoundError,
  updateMember,
} from "@/lib/members";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const cookieStore = await cookies();
  const session = getAuthenticatedSession(cookieStore.get(CMS_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ ok: false, error: "Invalid member id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Expected a JSON object." }, { status: 400 });
  }

  try {
    const member = updateMember(id, {
      email: body.email,
      telegramUsername: body.telegram_username,
      websiteCustomerCode: body.website_customer_code,
      plan: body.plan,
      status: body.status,
      comments: body.comments,
    });

    return NextResponse.json({ ok: true, member });
  } catch (error) {
    if (error instanceof MemberNotFoundError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    if (error instanceof MemberFieldConflictError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to update member." },
      { status: 400 }
    );
  }
}
