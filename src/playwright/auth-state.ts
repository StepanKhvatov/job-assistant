import { gunzipSync, gzipSync } from "node:zlib";

/** Playwright storageState shape (subset used for HH session export). */
export type HhStorageState = {
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

const HH_COOKIE_DOMAIN = /hh\.ru/i;

/** Cookies only from a full storageState; origins/localStorage are huge and not needed for HH auth. */
export function slimHhAuthState(state: HhStorageState): HhStorageState {
  const cookies = state.cookies.filter((c) => HH_COOKIE_DOMAIN.test(c.domain));
  return { cookies };
}

export function encodeHhAuthStateForSecret(state: HhStorageState): string {
  const slim = slimHhAuthState(state);
  const json = JSON.stringify(slim);
  if (Buffer.byteLength(json, "utf8") <= 48_000) {
    return Buffer.from(json, "utf8").toString("base64");
  }
  return `gz:${gzipSync(json).toString("base64")}`;
}

export function decodeHhAuthStateFromSecret(encoded: string): string {
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

export function parseHhAuthStateJson(json: string): HhStorageState {
  const parsed = JSON.parse(json) as HhStorageState;
  if (!Array.isArray(parsed.cookies)) {
    throw new Error("decoded JSON has no cookies array");
  }
  return parsed;
}
