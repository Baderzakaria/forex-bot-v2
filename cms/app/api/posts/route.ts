import { NextResponse } from "next/server";

import { listLatestPosts } from "@/lib/bot-data";

export async function GET() {
  return NextResponse.json({ posts: listLatestPosts() });
}
