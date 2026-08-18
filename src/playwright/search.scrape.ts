import { test } from "@playwright/test";

import { assertValidHhAuth, HH_AUTH_PROVIDER } from "./auth.js";
import { buildSearchUrl, resolveScrapeEnv } from "./config.js";
import { collectVacancyIdsFromSearch, unionVacancyIds } from "./search.js";

test("collect vacancy ids by keyword", async ({ page }) => {
  test.setTimeout(15 * 60 * 1000);

  const env = resolveScrapeEnv();
  assertValidHhAuth(env.authStatePath, env.authMetaPath, env.baseUrl);

  const keywords = env.searchKeywords;
  if (keywords.length === 0) {
    throw new Error("No search keywords");
  }

  let union: string[] = [];
  const perKeyword: Array<{ keyword: string; count: number; added: number; overlap: number }> = [];

  for (const keyword of keywords) {
    console.log(`[job-assistant][${HH_AUTH_PROVIDER}] searchUrl=${buildSearchUrl(env.baseUrl, keyword)}`);

    const result = await collectVacancyIdsFromSearch(page, env.baseUrl, keyword);
    const merged = unionVacancyIds(union, result.ids);
    union = merged.ids;
    perKeyword.push({
      keyword,
      count: result.ids.length,
      added: merged.added,
      overlap: merged.overlap,
    });
  }

  console.log(
    JSON.stringify(
      {
        keywords,
        perKeyword,
        unionCount: union.length,
        ids: union,
      },
      null,
      2,
    ),
  );
});
