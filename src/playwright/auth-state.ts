import { gunzipSync, gzipSync } from "node:zlib";

/** Playwright storageState (cookies + optional origins). */
export type PlaywrightStorageState = {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
  }>;
  origins?: unknown[];
};

export type CookieExpirySummary = {
  total: number;
  sessionCookies: number;
  expired: number;
  expiringWithinDays: number;
  earliestExpiry: Date | null;
};

function isSessionCookie(expires: number): boolean {
  return !Number.isFinite(expires) || expires <= 0;
}

export function slimAuthState(
  state: PlaywrightStorageState,
  cookieDomainPattern: RegExp,
): PlaywrightStorageState {
  const cookies = state.cookies.filter((c) => cookieDomainPattern.test(c.domain));
  return { cookies };
}

export function summarizeCookieExpiry(
  state: PlaywrightStorageState,
  withinDays = 7,
): CookieExpirySummary {
  const nowSec = Date.now() / 1000;
  const horizon = nowSec + withinDays * 86_400;
  let sessionCookies = 0;
  let expired = 0;
  let expiringWithinDays = 0;
  let earliest: number | null = null;

  for (const cookie of state.cookies) {
    if (isSessionCookie(cookie.expires)) {
      sessionCookies++;
      continue;
    }

    if (earliest === null || cookie.expires < earliest) {
      earliest = cookie.expires;
    }

    if (cookie.expires <= nowSec) {
      expired++;
    } else if (cookie.expires <= horizon) {
      expiringWithinDays++;
    }
  }

  return {
    total: state.cookies.length,
    sessionCookies,
    expired,
    expiringWithinDays,
    earliestExpiry: earliest === null ? null : new Date(earliest * 1000),
  };
}

export function encodeAuthStateForSecret(
  state: PlaywrightStorageState,
  cookieDomainPattern: RegExp,
): string {
  const slim = slimAuthState(state, cookieDomainPattern);
  const json = JSON.stringify(slim);
  if (Buffer.byteLength(json, "utf8") <= 48_000) {
    return Buffer.from(json, "utf8").toString("base64");
  }
  return `gz:${gzipSync(json).toString("base64")}`;
}

export function decodeAuthStateFromSecret(encoded: string): string {
  const trimmed = encoded.trim();
  if (trimmed.startsWith("gz:")) {
    return gunzipSync(Buffer.from(trimmed.slice(3), "base64")).toString("utf8");
  }

  const buf = Buffer.from(trimmed, "base64");
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString("utf8");
  }

  return buf.toString("utf8");
}

export function parseAuthStateJson(json: string): PlaywrightStorageState {
  const parsed = JSON.parse(json) as PlaywrightStorageState;
  if (!Array.isArray(parsed.cookies)) {
    throw new Error("decoded JSON has no cookies array");
  }
  return parsed;
}
