import { NextResponse } from "next/server";

import { listEvents } from "@/lib/bot-data";

export async function GET() {
  return NextResponse.json({ events: listEvents() });
}
