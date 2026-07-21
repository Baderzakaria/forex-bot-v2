import { NextResponse } from "next/server";

import { getSettingsView, upsertSetting } from "@/lib/bot-data";

export async function GET() {
  return NextResponse.json({ settings: getSettingsView() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string | undefined>;

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      upsertSetting(key, value);
    }
  }

  return NextResponse.json({ ok: true, settings: getSettingsView() });
}
