import "dotenv/config";

import { readFileSync } from "node:fs";

import { getEnv } from "../src/config/env.js";
import { HH_BOARD } from "../src/providers/hh.js";
import { assertValidHhAuth, resolveAuthPaths } from "../src/playwright/auth.js";
import {
  encodeAuthStateForSecret,
  parseAuthStateJson,
  slimAuthState,
} from "../src/playwright/auth-state.js";

const primary = HH_BOARD.auth.primary;
if (primary.kind !== "playwright-session") {
  throw new Error("HH primary auth is not a playwright session");
}
const cookieDomainPattern = primary.cookieDomainPattern;
const { statePath, metaPath } = resolveAuthPaths("hh");
const baseUrl = getEnv().HH_BASE_URL;

assertValidHhAuth(statePath, metaPath, baseUrl);

const fullState = parseAuthStateJson(readFileSync(statePath, "utf8"));
const slim = slimAuthState(fullState, cookieDomainPattern);
const stateB64 = encodeAuthStateForSecret(fullState, cookieDomainPattern);
const metaB64 = readFileSync(metaPath).toString("base64");

const fullBytes = readFileSync(statePath).length;
const slimBytes = Buffer.byteLength(JSON.stringify(slim), "utf8");

console.log("Add these GitHub repository secrets (slim export — hh.ru cookies only, no localStorage):\n");
console.log(`HH_AUTH_STATE_B64=${stateB64}\n`);
console.log(`HH_AUTH_META_B64=${metaB64}\n`);
console.log(
  `Sizes: full state ${fullBytes} B → slim ${slimBytes} B, secret ${stateB64.length} chars (GitHub limit 65536).`,
);
console.log(`Cookies: ${fullState.cookies.length} → ${slim.cookies.length} (hh.ru domains only).`);
console.log("\nThen remove HH_EMAIL / HH_PASSWORD from CI workflow (login runs only locally).");
console.log("Runbook: docs/AUTH.md");
