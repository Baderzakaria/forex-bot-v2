import { NextResponse } from "next/server";

import { searchFinancialWeb } from "@/lib/web-search";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    query?: string;
    context?: Record<string, unknown>;
    limit?: number;
  };
  const result = await searchFinancialWeb({
    query: body.query,
    context: body.context,
    limit: body.limit || 6,
  });
  return NextResponse.json(result);
}
