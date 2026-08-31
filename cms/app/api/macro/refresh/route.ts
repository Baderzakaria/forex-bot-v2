import { NextResponse } from "next/server";

import { getEnv, loadRootEnv } from "@/lib/env";

function botApiUrl() {
  return (getEnv("NEXT_PUBLIC_BOT_API_URL") || "http://127.0.0.1:8788").replace(/\/$/, "");
}

async function botResponse(path: string, init?: RequestInit) {
  loadRootEnv();
  const headers = new Headers(init?.headers);
  const secret = getEnv("BOT_API_SHARED_SECRET");
  if (secret) headers.set("x-bot-api-secret", secret);

  const response = await fetch(`${botApiUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({ ok: false, error: "Invalid bot response" }));
  return { response, body };
}

export async function GET() {
  try {
    const { response, body } = await botResponse("/api/discover");
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Bot API is unavailable" },
      { status: 502 }
    );
  }
}

export async function POST() {
  try {
    const { response, body } = await botResponse("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Bot API is unavailable" },
      { status: 502 }
    );
  }
}
