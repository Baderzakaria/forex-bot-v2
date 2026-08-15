import "server-only";

import { getSettingsView } from "@/lib/bot-data";
import { getEnv, loadRootEnv } from "@/lib/env";

export type TelegramChatSummary = {
  id: string;
  title: string;
  type: string;
};

export type TelegramStatus = {
  ok: boolean;
  botUsername: string;
  botId: string;
  maskedToken: string;
  adminChatId: string;
  publicChatId: string;
  writingChatId: string;
  error?: string;
};

function telegramApiUrl(token: string, method: string) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

function maskToken(token: string) {
  if (!token) return "";
  if (token.length <= 4) return token;
  return `••••${token.slice(-4)}`;
}

function effectiveChatId(settingValue: string, envName: string) {
  return settingValue || getEnv(envName);
}

function chatTitle(chat: {
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  id?: number | string;
}) {
  return (
    chat.title ||
    chat.username ||
    [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim() ||
    String(chat.id ?? "")
  );
}

async function telegramRequest<T>(token: string, method: string, params?: Record<string, string>) {
  const url = new URL(telegramApiUrl(token, method));
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as T & {
    ok?: boolean;
    description?: string;
  };

  return {
    response,
    data,
  };
}

function normalizeChat(chat: {
  id: number | string;
  type?: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}): TelegramChatSummary {
  return {
    id: String(chat.id),
    title: chatTitle(chat),
    type: chat.type || "unknown",
  };
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  loadRootEnv();

  const settings = getSettingsView();
  const token = getEnv("TELEGRAM_BOT_TOKEN");

  if (!token) {
    return {
      ok: false,
      botUsername: "",
      botId: "",
      maskedToken: "",
      adminChatId: effectiveChatId(settings.telegramAdminChatId, "TELEGRAM_ADMIN_CHAT_ID"),
      publicChatId: effectiveChatId(settings.telegramPublicChatId, "TELEGRAM_PUBLIC_CHAT_ID"),
      writingChatId: effectiveChatId(settings.telegramWritingChatId, "TELEGRAM_WRITING_CHAT_ID"),
      error: "TELEGRAM_BOT_TOKEN is missing",
    };
  }

  const { data } = await telegramRequest<{
    ok: boolean;
    result?: { id?: number | string; username?: string };
    description?: string;
  }>(token, "getMe");

  const chat = data.result;
  if (!data.ok || !chat || chat.id === undefined) {
    return {
      ok: false,
      botUsername: "",
      botId: "",
      maskedToken: maskToken(token),
      adminChatId: effectiveChatId(settings.telegramAdminChatId, "TELEGRAM_ADMIN_CHAT_ID"),
      publicChatId: effectiveChatId(settings.telegramPublicChatId, "TELEGRAM_PUBLIC_CHAT_ID"),
      writingChatId: effectiveChatId(settings.telegramWritingChatId, "TELEGRAM_WRITING_CHAT_ID"),
      error: data.description || "Telegram getMe failed",
    };
  }

  return {
    ok: true,
    botUsername: chat.username || "",
    botId: String(chat.id),
    maskedToken: maskToken(token),
    adminChatId: effectiveChatId(settings.telegramAdminChatId, "TELEGRAM_ADMIN_CHAT_ID"),
    publicChatId: effectiveChatId(settings.telegramPublicChatId, "TELEGRAM_PUBLIC_CHAT_ID"),
    writingChatId: effectiveChatId(settings.telegramWritingChatId, "TELEGRAM_WRITING_CHAT_ID"),
  };
}

export async function discoverTelegramChats(limit = 50): Promise<{
  ok: boolean;
  chats: TelegramChatSummary[];
  error?: string;
}> {
  loadRootEnv();
  const token = getEnv("TELEGRAM_BOT_TOKEN");

  if (!token) {
    return { ok: false, chats: [], error: "TELEGRAM_BOT_TOKEN is missing" };
  }

  const { data } = await telegramRequest<{
    ok: boolean;
    result?: Array<{
      message?: { chat?: TelegramChatSummary & Record<string, unknown> };
      edited_message?: { chat?: TelegramChatSummary & Record<string, unknown> };
      channel_post?: { chat?: TelegramChatSummary & Record<string, unknown> };
      edited_channel_post?: { chat?: TelegramChatSummary & Record<string, unknown> };
      my_chat_member?: { chat?: TelegramChatSummary & Record<string, unknown> };
    }>;
    description?: string;
  }>(token, "getUpdates", { limit: String(limit) });

  if (!data.ok || !Array.isArray(data.result)) {
    return {
      ok: false,
      chats: [],
      error: data.description || "Telegram getUpdates failed",
    };
  }

  const chats = new Map<string, TelegramChatSummary>();

  for (const update of data.result) {
    const candidates = [
      update.message?.chat,
      update.edited_message?.chat,
      update.channel_post?.chat,
      update.edited_channel_post?.chat,
      update.my_chat_member?.chat,
    ].filter(Boolean) as Array<{
      id: number | string;
      type?: string;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    }>;

    for (const chat of candidates) {
      const normalized = normalizeChat(chat);
      if (!normalized.id) continue;
      if (chats.has(normalized.id)) chats.delete(normalized.id);
      chats.set(normalized.id, normalized);
    }
  }

  return {
    ok: true,
    chats: Array.from(chats.values()).slice(-limit).reverse(),
  };
}

export async function validateTelegramChat(chatId: string): Promise<{
  ok: boolean;
  chat?: TelegramChatSummary;
  error?: string;
}> {
  loadRootEnv();
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const normalizedChatId = String(chatId || "").trim();

  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is missing" };
  }

  if (!normalizedChatId) {
    return { ok: false, error: "Missing chatId" };
  }

  const { data } = await telegramRequest<{
    ok: boolean;
    result?: {
      id?: number | string;
      type?: string;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    description?: string;
  }>(token, "getChat", { chat_id: normalizedChatId });

  const chat = data.result;
  if (!data.ok || !chat || chat.id === undefined || chat.id === null) {
    return {
      ok: false,
      error: data.description || "Telegram getChat failed",
    };
  }

  return {
    ok: true,
    chat: normalizeChat({ ...chat, id: chat.id }),
  };
}
