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
  formatHhSessionUi,
  verifyHhSessionOnPage,
} from "../src/playwright/auth-session.js";
import {
  parseAuthStateJson,
  summarizeCookieExpiry,
} from "../src/playwright/auth-state.js";
import { HH_GUEST_LOGIN_LINK_SELECTOR } from "../src/providers/hh.js";
import { logInfo } from "../src/utils/log.js";

logInfo("operation=hh:auth:check start");

const baseUrl = getEnv().HH_BASE_URL;
const headless = getEnv().HEADLESS;
const { statePath, metaPath } = resolveAuthPaths();

logInfo(`auth check op=files base_url=${baseUrl} headless=${headless}`);
logInfo(`auth check op=files state_path=${statePath} exists=${existsSync(statePath) ? "yes" : "no"}`);

assertValidHhAuth(statePath, metaPath, baseUrl);
logInfo("auth check op=validate_files ok");

const meta = readHhAuthMeta(metaPath);
const storage = parseAuthStateJson(readFileSync(statePath, "utf8"));
const expiry = summarizeCookieExpiry(storage, 7);
const origins = Array.isArray(storage.origins) ? storage.origins.length : 0;

logInfo(
  `auth check op=cookies provider=${meta?.provider} authenticated_at=${meta?.authenticatedAt} cookies=${storage.cookies.length} origins=${origins}`,
);

if (expiry.earliestExpiry) {
  logInfo(
    `auth check op=cookie_expiry expired=${expiry.expired} expiring_7d=${expiry.expiringWithinDays} session_cookies=${expiry.sessionCookies} earliest_expiry=${expiry.earliestExpiry.toISOString()}`,
  );
} else {
  logInfo(`auth check op=cookie_expiry session_only=${expiry.sessionCookies} (no dated expires)`);
}

if (expiry.expired > 0 || expiry.expiringWithinDays > 0) {
  logInfo("auth check warning: refresh session soon — docs/AUTH.md (playwright:auth → hh:auth:export)");
}

logInfo("auth check op=launch_browser");
const browser = await chromium.launch({ headless });
try {
  const context = await browser.newContext({
    storageState: statePath,
    locale: "ru-RU",
    timezoneId: "Asia/Novosibirsk",
  });
  const page = await context.newPage();
  logInfo(
    `auth check op=verify_session probe=homepage_then_applicant login_selector=${HH_GUEST_LOGIN_LINK_SELECTOR}`,
  );
  const session = await verifyHhSessionOnPage(page, baseUrl);

  if (!session.alive) {
    console.error(formatHhSessionExpiredError(session));
    process.exit(1);
  }

  logInfo(`auth check op=session_ok url=${session.url} ${formatHhSessionUi(session.ui)}`);
  await context.close();
} finally {
  await browser.close();
}

logInfo("operation=hh:auth:check done");
