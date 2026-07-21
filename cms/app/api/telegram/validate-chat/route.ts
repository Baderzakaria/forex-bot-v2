import { NextResponse } from "next/server";

import { validateTelegramChat } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json()) as { chatId?: string };
  const chatId = String(body.chatId || "").trim();

  if (!chatId) {
    return NextResponse.json({ ok: false, error: "Missing chatId" }, { status: 400 });
  }

  return NextResponse.json(await validateTelegramChat(chatId));
}
