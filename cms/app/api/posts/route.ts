import { NextResponse } from "next/server";

import { createPost, listLatestPosts } from "@/lib/bot-data";

export async function GET() {
  return NextResponse.json({ posts: listLatestPosts() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    draftText?: string;
    kind?: string;
    channel?: string;
  };

  const title = String(body.title || "").trim();
  const draftText = String(body.draftText || "").trim();
  const requestText = title || draftText || "cms draft";
  const post = createPost({
    kind: body.kind,
    draftText: draftText || title,
    requestText,
  });

  if (!post) {
    return NextResponse.json({ error: "Unable to create post" }, { status: 500 });
  }

  return NextResponse.json({ post, channel: body.channel || "telegram_admin" });
}
