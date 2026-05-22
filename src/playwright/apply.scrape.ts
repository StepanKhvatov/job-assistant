import { test } from "@playwright/test";

import { resolveApplyEnv } from "../config/apply-env.js";
import { loadCoverLetter } from "../config/load-content.js";
import { assertValidHhAuth, HH_AUTH_PROVIDER } from "./auth.js";
import { resolveScrapeEnv } from "./config.js";
import { applyToVacancy } from "./apply.js";

/**
 * Playwright Test: один отклик на вакансию (по умолчанию dry-run).
 *
 * Не пишет в БД — только UI. Для полного цикла с applications: npm run hh:apply
 */
test("apply to vacancy (dry-run by default)", async ({ page }) => {
  const scrapeEnv = resolveScrapeEnv();
  const applyEnv = resolveApplyEnv();
  assertValidHhAuth(scrapeEnv.authStatePath, scrapeEnv.authMetaPath, scrapeEnv.baseUrl);

  const hhId = process.env.HH_VACANCY_ID?.trim();
  if (!hhId) {
    throw new Error("Set HH_VACANCY_ID in .env (id из URL /vacancy/123456789)");
  }

  const coverLetter = loadCoverLetter();
  if (!coverLetter) {
    throw new Error("content/cover-letter.md is empty");
  }

  console.log(`[job-assistant][${HH_AUTH_PROVIDER}] hh_id=${hhId} dry_run=${applyEnv.dryRun}`);

  const result = await applyToVacancy(
    page,
    scrapeEnv.baseUrl,
    hhId,
    coverLetter,
    applyEnv.dryRun,
  );

  console.log(JSON.stringify(result, null, 2));

  test.info().attach("apply-result.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
});
