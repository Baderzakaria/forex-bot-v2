import "server-only";

import { getEnv } from "@/lib/env";
import {
  CMS_SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  timingSafeStringEqual,
  verifySessionToken,
} from "@/lib/auth-session";

export const CMS_SESSION_COOKIE = "cms_session";

type AuthConfig = {
  email: string;
  password: string;
  sessionSecret: string;
};

type CookieStore = {
  set: (name: string, value: string, options: ReturnType<typeof getSessionCookieOptions>) => unknown;
};

function isPlaceholder(value: string) {
  return /^(?:replace|change|your)[-_ ]/i.test(value);
}

export function getCmsAuthConfig(): AuthConfig | null {
  const email = getEnv("CMS_ADMIN_EMAIL").trim();
  const password = getEnv("CMS_PASSWORD");
  const sessionSecret = getEnv("CMS_SESSION_SECRET");

  if (
    !email ||
    !password ||
    !sessionSecret ||
    isPlaceholder(email) ||
    isPlaceholder(password) ||
    isPlaceholder(sessionSecret) ||
    sessionSecret.length < 32
  ) {
    return null;
  }

  return { email, password, sessionSecret };
}

export function areCmsCredentialsValid(email: string, password: string) {
  const config = getCmsAuthConfig();
  if (!config) return false;

  return (
    timingSafeStringEqual(email.trim().toLowerCase(), config.email.toLowerCase()) &&
    timingSafeStringEqual(password, config.password)
  );
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CMS_SESSION_MAX_AGE_SECONDS,
  };
}

export function setSessionCookie(cookieStore: CookieStore, email: string) {
  const config = getCmsAuthConfig();
  if (!config) throw new Error("CMS authentication is not configured");

  cookieStore.set(
    CMS_SESSION_COOKIE,
    createSessionToken(email, config.sessionSecret),
    getSessionCookieOptions()
  );
}

export function clearSessionCookie(cookieStore: CookieStore) {
  cookieStore.set(CMS_SESSION_COOKIE, "", { ...getSessionCookieOptions(), maxAge: 0 });
}

export function getAuthenticatedSession(token: string | undefined | null) {
  const config = getCmsAuthConfig();
  if (!config || !token) return null;

  const session = verifySessionToken(token, config.sessionSecret);
  if (!session || !timingSafeStringEqual(session.email.toLowerCase(), config.email.toLowerCase())) {
    return null;
  }

  return { email: config.email, expiresAt: session.expiresAt };
}
