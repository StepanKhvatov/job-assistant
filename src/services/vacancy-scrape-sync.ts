import { chromium } from "playwright";

import { assertValidHhAuth, HH_AUTH_PROVIDER } from "../playwright/auth.js";
import { buildSearchUrl, resolveScrapeEnv, type ScrapeEnv } from "../playwright/config.js";
import { collectVacancyIdsFromSearch } from "../playwright/search.js";
import type { ScrapeSyncResult } from "../playwright/types.js";
import { scrapeVacancyDetailById } from "../playwright/vacancy-page.js";
import { logInfo, logScrapeFail } from "../utils/log.js";
import { upsertScrapedVacancy } from "./upsert-vacancy.js";

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
    const vacancyIds = await collectVacancyIdsFromSearch(
      page,
      baseUrl,
      keyword,
      env.maxSearchPages,
    );
    logInfo(`search done ids=${vacancyIds.length} url=${searchUrl}`);

    const toProcess = vacancyIds.slice(0, env.maxVacanciesDetail);
    const skippedOverLimit = Math.max(0, vacancyIds.length - toProcess.length);
    if (skippedOverLimit > 0) {
      logInfo(`limit skip=${skippedOverLimit} (HH_SCRAPE_MAX_VACANCIES=${env.maxVacanciesDetail})`);
    }

    let upserted = 0;
    const total = toProcess.length;

    for (let i = 0; i < total; i++) {
      const hhId = toProcess[i];
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
      `finished upserted=${upserted} failed=${errors.length} ids_found=${vacancyIds.length}`,
    );

    return {
      keyword,
      searchUrl,
      listCount: vacancyIds.length,
      detailLimit: env.maxVacanciesDetail,
      upserted,
      skippedOverLimit,
      errors,
    };
  } finally {
    await browser.close();
  }
}
