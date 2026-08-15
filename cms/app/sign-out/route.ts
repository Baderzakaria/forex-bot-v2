import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/sign-in", request.url), 303);
  clearSessionCookie(response.cookies);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");

  return response;
}
