import { NextResponse } from "next/server";

import { getSettingsView } from "@/lib/bot-data";
import { getEnv, loadRootEnv } from "@/lib/env";

type Channel = "telegram_admin" | "telegram_writing" | "telegram_public";

function chatIdFor(channel: Channel) {
  const settings = getSettingsView();
  if (channel === "telegram_writing") {
    return (
      settings.telegramWritingChatId ||
      settings.telegramAdminChatId ||
      getEnv("TELEGRAM_WRITING_CHAT_ID") ||
      getEnv("TELEGRAM_ADMIN_CHAT_ID")
    );
  }
  if (channel === "telegram_public") {
    return (
      settings.telegramPublicChatId ||
      settings.telegramAdminChatId ||
      getEnv("TELEGRAM_PUBLIC_CHAT_ID") ||
      getEnv("TELEGRAM_ADMIN_CHAT_ID")
    );
  }
  return settings.telegramAdminChatId || getEnv("TELEGRAM_ADMIN_CHAT_ID");
}

export async function POST(request: Request) {
  loadRootEnv();
  const body = (await request.json()) as { text?: string; channel?: Channel };
  const text = String(body.text || "").trim();
  const channel = body.channel || "telegram_admin";
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = chatIdFor(channel);

  if (!text) {
    return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
  }
  if (!token || !chatId) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN or chat id missing in ../.env" },
      { status: 400 }
    );
  }

  const payload = {
    chat_id: chatId,
    text: `🧪 CMS TEST\n\n${text}`,
    disable_web_page_preview: true,
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) {
    return NextResponse.json(
      { ok: false, error: data.description || "Telegram send failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    channel,
    chatId,
    messageId: data.result?.message_id,
  });
}
