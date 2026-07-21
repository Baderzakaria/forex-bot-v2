import { NextResponse } from "next/server";

import { discoverTelegramChats } from "@/lib/telegram";

export async function POST() {
  return NextResponse.json(await discoverTelegramChats());
}
