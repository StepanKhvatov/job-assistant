import "dotenv/config";

import { getEnv } from "../src/config/env.js";
import { HH_DEFAULT_BASE_URL } from "../src/integrations/hh/constants.js";
import { resolveSearchTextFromEnv, syncVacanciesFromHh } from "../src/services/vacancy-sync.js";
import { prisma } from "../src/db/client.js";

const env = getEnv();

const searchText = resolveSearchTextFromEnv({
  HH_SEARCH_TEXT: env.HH_SEARCH_TEXT,
  HH_KEYWORDS: env.HH_KEYWORDS ?? env.HH_SEARCH_KEYWORD,
});

const userAgent = env.HH_USER_AGENT;
if (!userAgent) {
  console.error("Set HH_USER_AGENT (required by hh.ru API)");
  process.exit(1);
}

const accessToken = env.HH_ACCESS_TOKEN;
if (!accessToken) {
  console.error("Set HH_ACCESS_TOKEN from https://dev.hh.ru/admin");
  process.exit(1);
}

const result = await syncVacanciesFromHh({
  searchText,
  userAgent,
  accessToken,
  baseUrl: env.HH_API_BASE_URL ?? HH_DEFAULT_BASE_URL,
  maxPagesPerQuery: env.HH_MAX_PAGES_PER_QUERY ?? 5,
  detailDelayMs: env.HH_API_DETAIL_DELAY_MS ?? 350,
  includeOfficeNovosibirsk: env.HH_INCLUDE_OFFICE ?? true,
  includeRemoteRussia: env.HH_INCLUDE_REMOTE ?? true,
  maxVacanciesDetail: env.HH_MAX_VACANCIES_DETAIL ?? 200,
});

console.log(JSON.stringify({ searchText, ...result }, null, 2));

await prisma.$disconnect();

if (result.errors.length > 0) {
  process.exit(1);
}
