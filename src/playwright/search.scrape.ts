import { test } from "@playwright/test";

import { assertValidHhAuth, HH_AUTH_PROVIDER } from "./auth.js";
import { buildSearchUrl, resolveScrapeEnv } from "./config.js";
import { collectVacancyIdsFromSearch } from "./search.js";

test("collect vacancy ids by keyword", async ({ page }) => {
  const env = resolveScrapeEnv();
  assertValidHhAuth(env.authStatePath, env.authMetaPath, env.baseUrl);

  const keyword = env.searchKeyword;
  console.log(`[job-assistant][${HH_AUTH_PROVIDER}] searchUrl=${buildSearchUrl(env.baseUrl, keyword)}`);

  const vacancyIds = await collectVacancyIdsFromSearch(
    page,
    env.baseUrl,
    keyword,
    env.maxSearchPages,
  );

  console.log(JSON.stringify(vacancyIds, null, 2));
});
