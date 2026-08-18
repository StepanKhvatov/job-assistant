import { expect, test } from "@playwright/test";

import { getEnv } from "../config/env.js";
import { loadCoverLetter } from "../config/load-content.js";
import { getPlaywrightAdapter } from "./adapter.js";
import { APPLICATION_STATUS } from "./apply.js";
import { resolveScrapeEnv } from "./config.js";

/**
 * Playwright Test: один реальный отклик на вакансию.
 *
 * Не пишет в БД — только UI. Для полного цикла с applications: npm run hh:apply
 */
test("apply to vacancy", async ({ page }) => {
  const adapter = getPlaywrightAdapter("hh");
  const scrapeEnv = resolveScrapeEnv("hh");
  adapter.assertValidAuth(scrapeEnv.authStatePath, scrapeEnv.authMetaPath, scrapeEnv.baseUrl);
  await adapter.verifySession(page, scrapeEnv.baseUrl);

  const hhId = getEnv().HH_VACANCY_ID;
  if (!hhId) {
    throw new Error("Set HH_VACANCY_ID in .env (id из URL /vacancy/123456789)");
  }

  const coverLetter = loadCoverLetter();
  if (!coverLetter) {
    throw new Error("content/cover-letter.md is empty");
  }

  console.log(`[job-assistant][${adapter.board.sessionMetaProvider}] id=${hhId}`);

  const result = await adapter.applyToVacancy(page, scrapeEnv.baseUrl, hhId, coverLetter);

  console.log(JSON.stringify(result, null, 2));

  expect([
    APPLICATION_STATUS.applied,
    APPLICATION_STATUS.alreadyApplied,
    APPLICATION_STATUS.skippedForeignCountry,
    APPLICATION_STATUS.noButton,
    APPLICATION_STATUS.skippedQuestionnaire,
    APPLICATION_STATUS.skippedArchived,
    APPLICATION_STATUS.unconfirmed,
    APPLICATION_STATUS.failed,
  ]).toContain(result.status);

  test.info().attach("apply-result.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
});
