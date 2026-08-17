/**
 * Playwright-сбор вакансий hh.ru → таблица `vacancies`.
 *
 * Шаги: проверить cookies → обойти поиск → карточки новых и без description → upsert.
 * Вакансии с уже заполненным описанием пропускаются.
 * Retention после шага — только если RETENTION_INLINE=true (в CI выключено).
 */
import { chromium } from "playwright";

import { assertHhSessionOnPage } from "../playwright/auth-session.js";
import { assertValidHhAuth, HH_AUTH_PROVIDER } from "../playwright/auth.js";
import { buildSearchUrl, resolveScrapeEnv, type ScrapeEnv } from "../playwright/config.js";
import { collectVacancyIdsFromSearch } from "../playwright/search.js";
import { scrapeVacancyDetailById } from "../playwright/vacancy-page.js";
import { sleep } from "../utils/sleep.js";
import { logInfo, logScrapeFail } from "../utils/log.js";
import { findExistingVacancyScrapeState, upsertScrapedVacancy } from "./upsert-vacancy.js";
import { cleanupStaleVacanciesIfInline, type RetentionCleanupResult } from "./vacancy-retention.js";

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

export async function syncVacanciesFromScrape(
  options?: Partial<ScrapeEnv>,
): Promise<ScrapeSyncResult> {
  const env = { ...resolveScrapeEnv(), ...options };
  const { searchKeyword: keyword, baseUrl } = env;
  const searchUrl = buildSearchUrl(baseUrl, keyword);

  assertValidHhAuth(env.authStatePath, env.authMetaPath, baseUrl);

  const errors: string[] = [];
  const browser = await chromium.launch({ headless: env.headless });

  try {
    const context = await browser.newContext({
      storageState: env.authStatePath,
      locale: "ru-RU",
      timezoneId: "Asia/Novosibirsk",
    });
    const page = await context.newPage();

    await assertHhSessionOnPage(page, baseUrl);
    logInfo(`[${HH_AUTH_PROVIDER}] session alive base=${baseUrl}`);

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

    const existing = await findExistingVacancyScrapeState("hh", vacancyIds);
    let skippedExisting = 0;
    let upserted = 0;
    const total = vacancyIds.length;

    for (let i = 0; i < total; i++) {
      const externalId = vacancyIds[i];

      if (existing.skip.has(externalId)) {
        skippedExisting++;
        logInfo(`vacancy ${i + 1}/${total} provider=hh id=${externalId} skip (already in db)`);
        continue;
      }

      const reason = existing.refresh.has(externalId) ? "refresh (no description)" : "new";
      logInfo(`vacancy ${i + 1}/${total} provider=hh id=${externalId} ${reason}`);

      try {
        const detail = await scrapeVacancyDetailById(page, baseUrl, externalId);
        if (await upsertScrapedVacancy(detail)) {
          upserted++;
        } else {
          errors.push(`provider=hh id=${externalId}: db upsert failed`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logScrapeFail("hh", externalId, msg);
        errors.push(`provider=hh id=${externalId}: ${msg}`);
      }

      await sleep(env.detailDelayMs);
    }

    await context.close();

    logInfo(
      `finished upserted=${upserted} skipped_existing=${skippedExisting} failed=${errors.length} ids_found=${vacancyIds.length}`,
    );

    const retention = await cleanupStaleVacanciesIfInline();

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
