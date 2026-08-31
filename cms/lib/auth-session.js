import { createHmac, timingSafeEqual } from "node:crypto";

export const CMS_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Compares arbitrary strings without leaking a useful password-length timing signal.
 */
export function timingSafeStringEqual(left, right) {
  const leftDigest = createHmac("sha256", "cms-credential-compare").update(left).digest();
  const rightDigest = createHmac("sha256", "cms-credential-compare").update(right).digest();

  return timingSafeEqual(leftDigest, rightDigest);
}

export function createSessionToken(email, secret, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload = encode(
    JSON.stringify({
      v: 1,
      sub: email,
      iat: issuedAt,
      exp: issuedAt + CMS_SESSION_MAX_AGE_SECONDS,
    })
  );

  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof token !== "string") return null;

  const [payload, signature, ...extraParts] = token.split(".");
  if (!payload || !signature || extraParts.length || !safeEqual(sign(payload, secret), signature)) {
    return null;
  }

  try {
    const session = JSON.parse(decode(payload));
    const currentTime = Math.floor(now / 1000);

    if (
      session?.v !== 1 ||
      typeof session.sub !== "string" ||
      !session.sub ||
      !Number.isInteger(session.iat) ||
      !Number.isInteger(session.exp) ||
      session.iat > currentTime + 60 ||
      session.exp <= currentTime ||
      session.exp - session.iat > CMS_SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }

    return { email: session.sub, expiresAt: session.exp };
  } catch {
    return null;
  }
}

/**
 * Return destinations must stay within this CMS origin. The returned value is
 * normalized so it can be passed directly to Next's redirect().
 */
export function getSafeReturnPath(value, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }

  try {
    const origin = "https://cms.local";
    const destination = new URL(value, origin);

    if (destination.origin !== origin || !destination.pathname.startsWith("/")) {
      return fallback;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
