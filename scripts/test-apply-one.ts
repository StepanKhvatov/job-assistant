import "dotenv/config";

import { chromium } from "playwright";

import { loadCoverLetter } from "../src/config/load-content.js";
import { resolveApplyEnv } from "../src/config/apply-env.js";
import { applyToVacancy } from "../src/playwright/apply.js";
import { assertValidHhAuth } from "../src/playwright/auth.js";
import { resolveScrapeEnv } from "../src/playwright/config.js";

const hhId = process.argv[2] ?? process.env.HH_VACANCY_ID;
if (!hhId) {
  console.error("Usage: tsx scripts/test-apply-one.ts <hh_id>");
  process.exit(1);
}

const scrapeEnv = resolveScrapeEnv();
const applyEnv = resolveApplyEnv();
assertValidHhAuth(scrapeEnv.authStatePath, scrapeEnv.authMetaPath, scrapeEnv.baseUrl);

const coverLetter = loadCoverLetter();
if (!coverLetter) {
  throw new Error("content/cover-letter.md is empty");
}

const browser = await chromium.launch({ headless: applyEnv.headless });
const context = await browser.newContext({
  storageState: scrapeEnv.authStatePath,
  locale: "ru-RU",
  timezoneId: "Asia/Novosibirsk",
});
const page = await context.newPage();

const result = await applyToVacancy(
  page,
  scrapeEnv.baseUrl,
  hhId,
  coverLetter,
  applyEnv.dryRun,
);

console.log(JSON.stringify(result, null, 2));

await context.close();
await browser.close();

if (result.status === "failed") {
  process.exit(1);
}
