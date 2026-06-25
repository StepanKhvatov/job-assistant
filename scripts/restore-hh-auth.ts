import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { getEnv } from "../src/config/env.js";
import {
  getHhLoginUrl,
  HH_AUTH_PROVIDER,
  resolveAuthPaths,
  writeHhAuthMeta,
} from "../src/playwright/auth.js";
import { logInfo } from "../src/utils/log.js";

const stateB64 = process.env.HH_AUTH_STATE_B64?.trim();

if (!stateB64) {
  if (process.env.CI === "true") {
    throw new Error(
      "HH_AUTH_STATE_B64 is required in CI. Export locally: npm run hh:auth:export",
    );
  }
  logInfo("HH_AUTH_STATE_B64 not set — using existing .auth/hh-user.json");
  process.exit(0);
}

const { statePath, metaPath } = resolveAuthPaths();
mkdirSync(dirname(statePath), { recursive: true });

let stateJson: string;
try {
  stateJson = Buffer.from(stateB64, "base64").toString("utf8");
  const parsed = JSON.parse(stateJson) as { cookies?: unknown };
  if (!Array.isArray(parsed.cookies)) {
    throw new Error("decoded JSON has no cookies array");
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  throw new Error(`HH_AUTH_STATE_B64 is invalid: ${msg}`);
}

writeFileSync(statePath, stateJson);
logInfo(`restored ${statePath} from HH_AUTH_STATE_B64 cookies=${JSON.parse(stateJson).cookies.length}`);

const metaB64 = process.env.HH_AUTH_META_B64?.trim();
if (metaB64) {
  try {
    const metaJson = Buffer.from(metaB64, "base64").toString("utf8");
    JSON.parse(metaJson);
    writeFileSync(metaPath, metaJson);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`HH_AUTH_META_B64 is invalid: ${msg}`);
  }
  logInfo(`restored ${metaPath} from HH_AUTH_META_B64`);
} else {
  const baseUrl = getEnv().HH_BASE_URL;
  writeHhAuthMeta(metaPath, {
    provider: HH_AUTH_PROVIDER,
    baseUrl,
    loginUrl: getHhLoginUrl(baseUrl),
    authenticatedAt: new Date().toISOString(),
    accountRole: "applicant",
  });
  logInfo(`wrote ${metaPath} from HH_BASE_URL (no HH_AUTH_META_B64)`);
}
