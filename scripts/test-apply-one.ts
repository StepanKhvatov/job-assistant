import "dotenv/config";

import { chromium } from "playwright";

import { resolveApplyEnv } from "../src/config/apply-env.js";
import { loadCoverLetter } from "../src/config/load-content.js";
import { getPlaywrightAdapter } from "../src/playwright/adapter.js";
import { resolveScrapeEnv } from "../src/playwright/config.js";

const hhId = process.argv[2] ?? process.env.HH_VACANCY_ID;
if (!hhId) {
  console.error("Usage: tsx scripts/test-apply-one.ts <hh_id>");
  process.exit(1);
}

const adapter = getPlaywrightAdapter("hh");
const scrapeEnv = resolveScrapeEnv("hh");
const applyEnv = resolveApplyEnv("hh");
adapter.assertValidAuth(scrapeEnv.authStatePath, scrapeEnv.authMetaPath, scrapeEnv.baseUrl);

const coverLetter = loadCoverLetter();
if (!coverLetter) {
  throw new Error("content/cover-letter.md is empty");
}

const browser = await chromium.launch({ headless: applyEnv.headless });
const context = await browser.newContext({
  storageState: scrapeEnv.authStatePath,
  locale: adapter.board.browser.locale,
  timezoneId: adapter.board.browser.timezoneId,
});
const page = await context.newPage();

const result = await adapter.applyToVacancy(page, scrapeEnv.baseUrl, hhId, coverLetter);

console.log(JSON.stringify(result, null, 2));

await context.close();
await browser.close();

if (result.status === "failed") {
  process.exit(1);
}
