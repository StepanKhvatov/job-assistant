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
import {
  parseHhAuthStateJson,
  summarizeCookieExpiry,
} from "../src/playwright/auth-state.js";
import { logInfo } from "../src/utils/log.js";

const baseUrl = getEnv().HH_BASE_URL;
const headless = getEnv().HEADLESS;
const { statePath, metaPath } = resolveAuthPaths();

logInfo(`auth check base_url=${baseUrl} headless=${headless}`);
logInfo(`auth check state_path=${statePath} exists=${existsSync(statePath)}`);

assertValidHhAuth(statePath, metaPath, baseUrl);

const meta = readHhAuthMeta(metaPath);
const storage = parseHhAuthStateJson(readFileSync(statePath, "utf8"));
const expiry = summarizeCookieExpiry(storage, 7);
const origins = Array.isArray(storage.origins) ? storage.origins.length : 0;

logInfo(
  `auth check meta provider=${meta?.provider} authenticated_at=${meta?.authenticatedAt} cookies=${storage.cookies.length} origins=${origins}`,
);

if (expiry.earliestExpiry) {
  logInfo(
    `auth check cookies expired=${expiry.expired} expiring_7d=${expiry.expiringWithinDays} session_cookies=${expiry.sessionCookies} earliest_expiry=${expiry.earliestExpiry.toISOString()}`,
  );
} else {
  logInfo(`auth check cookies session_only=${expiry.sessionCookies} (no dated expires)`);
}

if (expiry.expired > 0 || expiry.expiringWithinDays > 0) {
  logInfo("auth check warning: refresh session soon — docs/AUTH.md (playwright:auth → hh:auth:export)");
}

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
