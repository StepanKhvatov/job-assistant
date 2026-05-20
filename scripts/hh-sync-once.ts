import "dotenv/config";

import { HH_DEFAULT_BASE_URL } from "../src/integrations/hh/constants.js";
import { resolveSearchTextFromEnv, syncVacanciesFromHh } from "../src/services/vacancy-sync.js";
import { prisma } from "../src/db/client.js";

const searchText = resolveSearchTextFromEnv({
  HH_SEARCH_TEXT: process.env.HH_SEARCH_TEXT,
  HH_KEYWORDS: process.env.HH_KEYWORDS,
});

const userAgent = process.env.HH_USER_AGENT?.trim();
if (!userAgent) {
  console.error("Set HH_USER_AGENT (required by hh.ru API)");
  process.exit(1);
}

const accessToken = process.env.HH_ACCESS_TOKEN?.trim();
if (!accessToken) {
  console.error("Set HH_ACCESS_TOKEN from https://dev.hh.ru/admin");
  process.exit(1);
}

const maxPages = Math.min(
  20,
  Math.max(1, Number.parseInt(process.env.HH_MAX_PAGES_PER_QUERY ?? "5", 10) || 5),
);
const detailDelayMs = Math.min(
  5000,
  Math.max(0, Number.parseInt(process.env.HH_DETAIL_DELAY_MS ?? "350", 10) || 350),
);

const maxVacanciesDetail = Math.min(
  2000,
  Math.max(1, Number.parseInt(process.env.HH_MAX_VACANCIES_DETAIL ?? "200", 10) || 200),
);

const result = await syncVacanciesFromHh({
  searchText,
  userAgent,
  accessToken,
  baseUrl: process.env.HH_BASE_URL?.trim() || HH_DEFAULT_BASE_URL,
  maxPagesPerQuery: maxPages,
  detailDelayMs,
  includeOfficeNovosibirsk: process.env.HH_INCLUDE_OFFICE !== "false",
  includeRemoteRussia: process.env.HH_INCLUDE_REMOTE !== "false",
  maxVacanciesDetail,
});

console.log(JSON.stringify({ searchText, ...result }, null, 2));

await prisma.$disconnect();

if (result.errors.length > 0) {
  process.exit(1);
}
