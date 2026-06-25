import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";

import { chromium } from "playwright";

import { getEnv } from "../src/config/env.js";
import {
  assertValidHhAuth,
  readHhAuthMeta,
  resolveAuthPaths,
} from "../src/playwright/auth.js";
import {
  formatHhSessionExpiredError,
  verifyHhSessionOnPage,
} from "../src/playwright/auth-session.js";
import { logInfo } from "../src/utils/log.js";

function validateStorageStateJson(statePath: string): { cookies: number; origins: number } {
  const raw = readFileSync(statePath, "utf8");
  const parsed = JSON.parse(raw) as { cookies?: unknown[]; origins?: unknown[] };
  if (!Array.isArray(parsed.cookies)) {
    throw new Error(`${statePath}: invalid Playwright storageState (no cookies array)`);
  }
  return {
    cookies: parsed.cookies.length,
    origins: Array.isArray(parsed.origins) ? parsed.origins.length : 0,
  };
}

const baseUrl = getEnv().HH_BASE_URL;
const headless = getEnv().HEADLESS;
const { statePath, metaPath } = resolveAuthPaths();

logInfo(`auth check base_url=${baseUrl} headless=${headless}`);
logInfo(`auth check state_path=${statePath} exists=${existsSync(statePath)}`);

assertValidHhAuth(statePath, metaPath, baseUrl);

const meta = readHhAuthMeta(metaPath);
const storage = validateStorageStateJson(statePath);
logInfo(
  `auth check meta provider=${meta?.provider} authenticated_at=${meta?.authenticatedAt} cookies=${storage.cookies} origins=${storage.origins}`,
);

const browser = await chromium.launch({ headless });
try {
  const context = await browser.newContext({
    storageState: statePath,
    locale: "ru-RU",
    timezoneId: "Asia/Novosibirsk",
  });
  const page = await context.newPage();
  const session = await verifyHhSessionOnPage(page, baseUrl);

  if (!session.alive) {
    console.error(formatHhSessionExpiredError(session));
    process.exit(1);
  }

  logInfo(`auth check session alive url=${session.url}`);
  await context.close();
} finally {
  await browser.close();
}

logInfo("auth check ok");
