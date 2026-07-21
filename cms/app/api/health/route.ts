import { NextResponse } from "next/server";

import { getBotHealth } from "@/lib/bot-data";

export async function GET() {
  const local = getBotHealth();
  const proxyUrl = process.env.NEXT_PUBLIC_BOT_API_URL || "http://127.0.0.1:8788";

  try {
    const response = await fetch(`${proxyUrl.replace(/\/$/, "")}/api/health`, {
      cache: "no-store",
    });

    if (response.ok) {
      return NextResponse.json({
        ...local,
        source: "proxy",
        proxy: await response.json(),
      });
    }
  } catch {
    // fall back to local health
  }

  return NextResponse.json(local);
}
