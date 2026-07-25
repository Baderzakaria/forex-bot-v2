import { NextResponse } from "next/server";

import {
  enqueueOutbox,
  getPostById,
  getSettingsView,
  listOutbox,
  updatePostDraft,
} from "@/lib/bot-data";
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

export async function GET() {
  return NextResponse.json({ outbox: listOutbox() });
}

export async function POST(request: Request) {
  loadRootEnv();
  const body = (await request.json()) as {
    scheduledAt?: string;
    channel?: Channel;
    text?: string;
    postId?: string;
    contentVersion?: number;
    createdBy?: string;
  };

  const channel = body.channel || "telegram_admin";
  const scheduledAt = body.scheduledAt || new Date().toISOString();
  const text = String(body.text || "").trim();
  const postId = String(body.postId || "").trim();
  const destinationId = chatIdFor(channel);
  const settings = getSettingsView();

  if (!destinationId) {
    return NextResponse.json(
      { ok: false, error: "Telegram chat id is missing for the selected channel" },
      { status: 400 }
    );
  }

  let post = postId ? getPostById(postId) : null;
  if (postId && !post) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }

  if (post && text) {
    post = updatePostDraft(post.post_id, {
      draftText: text,
    });
  }

  const contentText = text || post?.draft_text || "";
  if (!contentText.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing message text" },
      { status: 400 }
    );
  }

  if (channel === "telegram_public" && (settings.publishingPaused === "true" || settings.pauseMode === "true")) {
    return NextResponse.json(
      {
        ok: false,
        error: "Publishing is paused. Public sends stay blocked until pause mode is cleared.",
        post,
      },
      { status: 409 }
    );
  }

  if (post && (channel === "telegram_public" || channel === "telegram_writing")) {
    post = updatePostDraft(post.post_id, {
      status: "approved",
    });
  }

  const outbox = enqueueOutbox({
    destinationType: channel,
    destinationId,
    contentText,
    scheduledAt,
    postId: post?.post_id || postId || "",
    contentVersion: post?.version || body.contentVersion || null,
    createdBy: body.createdBy || "cms",
  });

  if (!outbox) {
    return NextResponse.json(
      { ok: false, error: "Unable to queue outbox item" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, post, outbox });
}
