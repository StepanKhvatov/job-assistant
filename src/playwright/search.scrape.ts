import { test } from "@playwright/test";

import { assertValidHhAuth, HH_AUTH_PROVIDER } from "./auth.js";
import { buildSearchUrl, resolveScrapeEnv } from "./config.js";
import { collectVacancyIdsFromSearch } from "./search.js";

test("collect vacancy ids by keyword", async ({ page }) => {
  const env = resolveScrapeEnv();
  assertValidHhAuth(env.authStatePath, env.authMetaPath, env.baseUrl);

  const keyword = env.searchKeyword;
  console.log(`[job-assistant][${HH_AUTH_PROVIDER}] searchUrl=${buildSearchUrl(env.baseUrl, keyword)}`);

  const result = await collectVacancyIdsFromSearch(
    page,
    env.baseUrl,
    keyword,
  );

  console.log(
    JSON.stringify(
      {
        totalReported: result.totalReported,
        totalPages: result.totalPages,
        pagesVisited: result.pagesVisited,
        count: result.ids.length,
        ids: result.ids,
      },
      null,
      2,
    ),
  );
});
