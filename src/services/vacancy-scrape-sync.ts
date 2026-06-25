import { chromium } from "playwright";

import { assertValidHhAuth, HH_AUTH_PROVIDER } from "../playwright/auth.js";
import { buildSearchUrl, resolveScrapeEnv, type ScrapeEnv } from "../playwright/config.js";
import { collectVacancyIdsFromSearch } from "../playwright/search.js";
import type { RetentionCleanupResult } from "./vacancy-retention.js";

export type ScrapeSyncResult = {
  keyword: string;
  searchUrl: string;
  totalReported: number | null;
  totalPages: number;
  pagesVisited: number;
  listCount: number;
  skippedExisting: number;
  upserted: number;
  retention: RetentionCleanupResult;
  errors: string[];
};
import { scrapeVacancyDetailById } from "../playwright/vacancy-page.js";
import { logInfo, logScrapeFail } from "../utils/log.js";
import { findExistingVacancyHhIds, upsertScrapedVacancy } from "./upsert-vacancy.js";
import { cleanupStaleVacancies } from "./vacancy-retention.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncVacanciesFromScrape(
  options?: Partial<ScrapeEnv>,
): Promise<ScrapeSyncResult> {
  const env = { ...resolveScrapeEnv(), ...options };
  const { searchKeyword: keyword, baseUrl } = env;
  const searchUrl = buildSearchUrl(baseUrl, keyword);

  assertValidHhAuth(env.authStatePath, env.authMetaPath, baseUrl);
  logInfo(`[${HH_AUTH_PROVIDER}] session ok base=${baseUrl}`);

  const errors: string[] = [];
  const browser = await chromium.launch({ headless: env.headless });

  try {
    const context = await browser.newContext({
      storageState: env.authStatePath,
      locale: "ru-RU",
      timezoneId: "Asia/Novosibirsk",
    });
    const page = await context.newPage();

    logInfo(`search keyword="${keyword}"`);
    const search = await collectVacancyIdsFromSearch(
      page,
      baseUrl,
      keyword,
    );
    const vacancyIds = search.ids;
    logInfo(
      `search done ids=${vacancyIds.length} pages=${search.pagesVisited}/${search.totalPages} total_reported=${search.totalReported ?? "?"}`,
    );

    const toProcess = vacancyIds;

    const existingHhIds = await findExistingVacancyHhIds(toProcess);
    let skippedExisting = 0;
    let upserted = 0;
    const total = toProcess.length;

    for (let i = 0; i < total; i++) {
      const hhId = toProcess[i];

      if (existingHhIds.has(hhId)) {
        skippedExisting++;
        logInfo(`vacancy ${i + 1}/${total} hh_id=${hhId} skip (already in db)`);
        continue;
      }

      logInfo(`vacancy ${i + 1}/${total} hh_id=${hhId}`);

      try {
        const detail = await scrapeVacancyDetailById(page, baseUrl, hhId);
        if (await upsertScrapedVacancy(detail)) {
          upserted++;
        } else {
          errors.push(`hh_id=${hhId}: db upsert failed`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logScrapeFail(hhId, msg);
        errors.push(`hh_id=${hhId}: ${msg}`);
      }

      await sleep(env.detailDelayMs);
    }

    await context.close();

    logInfo(
      `finished upserted=${upserted} skipped_existing=${skippedExisting} failed=${errors.length} ids_found=${vacancyIds.length}`,
    );

    const retention = await cleanupStaleVacancies();

    return {
      keyword,
      searchUrl,
      totalReported: search.totalReported,
      totalPages: search.totalPages,
      pagesVisited: search.pagesVisited,
      listCount: vacancyIds.length,
      skippedExisting,
      upserted,
      retention,
      errors,
    };
  } finally {
    await browser.close();
  }
}
