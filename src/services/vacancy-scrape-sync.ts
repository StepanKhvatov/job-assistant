/**
 * Playwright-сбор вакансий → таблица `vacancies`.
 *
 * Борд задаётся адаптером (`getPlaywrightAdapter`). HH — единственный active.
 * Retention после шага — только если RETENTION_INLINE=true (в CI выключено).
 */
import { chromium } from "playwright";

import { getPlaywrightAdapter } from "../playwright/adapter.js";
import { resolveScrapeEnv, type ScrapeEnv } from "../playwright/config.js";
import type { JobBoardId } from "../providers/types.js";
import { sleep } from "../utils/sleep.js";
import { logInfo, logScrapeFail } from "../utils/log.js";
import { findExistingVacancyScrapeState, upsertScrapedVacancy } from "./upsert-vacancy.js";
import { cleanupStaleVacanciesIfInline, type RetentionCleanupResult } from "./vacancy-retention.js";

export type ScrapeSyncResult = {
  provider: JobBoardId;
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
  const boardId = options?.boardId ?? "hh";
  const adapter = getPlaywrightAdapter(boardId);
  const env = { ...resolveScrapeEnv(boardId), ...options };
  const { searchKeyword: keyword, baseUrl } = env;
  const searchUrl = adapter.buildSearchUrl(baseUrl, keyword);
  const logPrefix = adapter.board.sessionMetaProvider;

  adapter.assertValidAuth(env.authStatePath, env.authMetaPath, baseUrl);

  const errors: string[] = [];
  const browser = await chromium.launch({ headless: env.headless });

  try {
    const context = await browser.newContext({
      storageState: env.authStatePath,
      locale: adapter.board.browser.locale,
      timezoneId: adapter.board.browser.timezoneId,
    });
    const page = await context.newPage();

    logInfo(`[${logPrefix}] scrape op=verify_session`);
    const session = await adapter.verifySession(page, baseUrl);
    logInfo(`[${logPrefix}] scrape op=session_ok base=${baseUrl} url=${session.url}`);

    logInfo(`scrape op=search keyword="${keyword}"`);
    const search = await adapter.collectSearchIds(page, baseUrl, keyword);
    const vacancyIds = search.ids;
    logInfo(
      `search done ids=${vacancyIds.length} pages=${search.pagesVisited}/${search.totalPages} total_reported=${search.totalReported ?? "?"}`,
    );

    const existing = await findExistingVacancyScrapeState(boardId, vacancyIds);
    let skippedExisting = 0;
    let upserted = 0;
    const total = vacancyIds.length;

    for (let i = 0; i < total; i++) {
      const externalId = vacancyIds[i];

      if (existing.skip.has(externalId)) {
        skippedExisting++;
        logInfo(`vacancy ${i + 1}/${total} provider=${boardId} id=${externalId} skip (already in db)`);
        continue;
      }

      const reason = existing.refresh.has(externalId) ? "refresh (no description)" : "new";
      logInfo(`vacancy ${i + 1}/${total} provider=${boardId} id=${externalId} ${reason}`);

      try {
        const detail = await adapter.scrapeDetail(page, baseUrl, externalId);
        if (await upsertScrapedVacancy(detail)) {
          upserted++;
        } else {
          errors.push(`provider=${boardId} id=${externalId}: db upsert failed`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logScrapeFail(boardId, externalId, msg);
        errors.push(`provider=${boardId} id=${externalId}: ${msg}`);
      }

      await sleep(env.detailDelayMs);
    }

    await context.close();

    logInfo(
      `finished upserted=${upserted} skipped_existing=${skippedExisting} failed=${errors.length} ids_found=${vacancyIds.length}`,
    );

    const retention = await cleanupStaleVacanciesIfInline();

    return {
      provider: boardId,
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
