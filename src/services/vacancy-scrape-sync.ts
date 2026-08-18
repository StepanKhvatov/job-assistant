/**
 * Playwright-сбор вакансий → таблица `vacancies`.
 *
 * Борд задаётся адаптером (`getPlaywrightAdapter`). HH — единственный active.
 * Поиск: отдельный SERP на каждую фразу, затем один проход по карточкам.
 * Retention после шага — только если RETENTION_INLINE=true (в CI выключено).
 */
import { chromium } from "playwright";

import { getPlaywrightAdapter } from "../playwright/adapter.js";
import { resolveScrapeEnv, type ScrapeEnv } from "../playwright/config.js";
import { unionVacancyIds } from "../playwright/search.js";
import type { SearchCollectionResult } from "../playwright/types.js";
import type { JobBoardId } from "../providers/types.js";
import { sleep } from "../utils/sleep.js";
import { logInfo, logScrapeFail } from "../utils/log.js";
import { findExistingVacancyScrapeState, upsertScrapedVacancy } from "./upsert-vacancy.js";
import { cleanupStaleVacanciesIfInline, type RetentionCleanupResult } from "./vacancy-retention.js";

export type KeywordSearchSummary = {
  keyword: string;
  searchUrl: string;
  totalReported: number | null;
  totalPages: number;
  pagesVisited: number;
  idsFound: number;
  idsAdded: number;
  overlap: number;
  error?: string;
};

export type ScrapeSyncResult = {
  provider: JobBoardId;
  keywords: string[];
  searches: KeywordSearchSummary[];
  listCount: number;
  skippedExisting: number;
  upserted: number;
  retention: RetentionCleanupResult;
  errors: string[];
};

function resolveKeywords(env: ScrapeEnv): string[] {
  const keywords = env.searchKeywords.map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) {
    throw new Error(
      "No HH search keywords: fill «Поиск на hh.ru» in content/candidate-profile.md or set HH_SEARCH_KEYWORD",
    );
  }
  return keywords;
}

export async function syncVacanciesFromScrape(
  options?: Partial<ScrapeEnv>,
): Promise<ScrapeSyncResult> {
  const boardId = options?.boardId ?? "hh";
  const adapter = getPlaywrightAdapter(boardId);
  const env = { ...resolveScrapeEnv(boardId), ...options };
  const keywords = resolveKeywords(env);
  const { baseUrl } = env;
  const logPrefix = adapter.board.sessionMetaProvider;

  adapter.assertValidAuth(env.authStatePath, env.authMetaPath, baseUrl);

  const errors: string[] = [];
  const searches: KeywordSearchSummary[] = [];
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

    let vacancyIds: string[] = [];

    for (const [i, keyword] of keywords.entries()) {
      const searchUrl = adapter.buildSearchUrl(baseUrl, keyword);
      logInfo(
        `scrape op=search keyword="${keyword}" ${i + 1}/${keywords.length} url=${searchUrl}`,
      );

      let search: SearchCollectionResult | null = null;
      let keywordError: string | undefined;
      try {
        search = await adapter.collectSearchIds(page, baseUrl, keyword);
      } catch (e) {
        keywordError = e instanceof Error ? e.message : String(e);
        logInfo(`search keyword fail keyword="${keyword}" error="${keywordError}"`);
        errors.push(`keyword="${keyword}": ${keywordError}`);
      }

      const incoming = search?.ids ?? [];
      const merged = unionVacancyIds(vacancyIds, incoming);
      logInfo(
        `search keyword done keyword="${keyword}" ids=${incoming.length} unique_added=${merged.added} overlap=${merged.overlap} pages=${search?.pagesVisited ?? 0}/${search?.totalPages ?? 0} total_reported=${search?.totalReported ?? "?"}`,
      );

      searches.push({
        keyword,
        searchUrl,
        totalReported: search?.totalReported ?? null,
        totalPages: search?.totalPages ?? 0,
        pagesVisited: search?.pagesVisited ?? 0,
        idsFound: incoming.length,
        idsAdded: merged.added,
        overlap: merged.overlap,
        error: keywordError,
      });
      vacancyIds = merged.ids;

      if (i + 1 < keywords.length) {
        await sleep(env.detailDelayMs);
      }
    }

    logInfo(
      `search union ids=${vacancyIds.length} keywords=${keywords.length} keyword_errors=${searches.filter((s) => s.error).length}`,
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
      keywords,
      searches,
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
