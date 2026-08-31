import { NextResponse, type NextRequest } from "next/server";

import {
  CMS_SESSION_COOKIE,
  clearSessionCookie,
  getAuthenticatedSession,
} from "@/lib/auth-edge";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function unauthenticatedApiResponse(request: NextRequest) {
  const response = NextResponse.json(
    { error: "unauthorized", message: "Authentication is required." },
    { status: 401 }
  );

  if (request.cookies.get(CMS_SESSION_COOKIE)?.value) {
    clearSessionCookie(response.cookies);
  }

  return noStore(response);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/api/health" || ((pathname === "/api/members" || pathname === "/api/payments") && request.method === "POST")) {
    return noStore(NextResponse.next());
  }

  if (pathname === "/sign-in") {
    return noStore(NextResponse.next());
  }

  const session = await getAuthenticatedSession(request.cookies.get(CMS_SESSION_COOKIE)?.value);
  if (session) {
    return noStore(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    return unauthenticatedApiResponse(request);
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("returnTo", `${pathname}${search}`);
  const response = NextResponse.redirect(signInUrl);

  if (request.cookies.get(CMS_SESSION_COOKIE)?.value) {
    clearSessionCookie(response.cookies);
  }

  return noStore(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
