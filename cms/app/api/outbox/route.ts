import { NextResponse } from "next/server";

import { listOutbox } from "@/lib/bot-data";

export async function GET() {
  return NextResponse.json({ outbox: listOutbox() });
}
