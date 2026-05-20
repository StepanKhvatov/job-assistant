import { resolveAuthPaths } from "./auth.js";
import { normalizeSearchKeyword, resolveSearchKeyword } from "./search-keyword.js";

export const DEFAULT_SCRAPE_BASE_URL = "https://novosibirsk.hh.ru";
export { DEFAULT_AUTH_STATE_PATH, DEFAULT_AUTH_META_PATH, HH_AUTH_PROVIDER } from "./auth.js";
export { normalizeSearchKeyword, resolveSearchKeyword } from "./search-keyword.js";

/**
 * Параметры URL выдачи hh.ru `/search/vacancy`.
 *
 * Нужны: `text` (одна фраза, UTF-8 через URLSearchParams).
 * Пагинация в браузере — клик `a[data-qa="pager-next"]`, не параметр `page`.
 *
 * Не нужны: `from`, `suggestId`, `hhtmFrom`, `hhtmFromLabel`, `ored_clusters`.
 */
export type VacancySearchUrlOptions = {
  /** Искать только в названии вакансии. */
  searchFieldName?: boolean;
};

export type ScrapeEnv = {
  baseUrl: string;
  authStatePath: string;
  authMetaPath: string;
  /** Одна фраза для ?text= (скрапинг). */
  searchKeyword: string;
  maxSearchPages: number;
  maxVacanciesDetail: number;
  detailDelayMs: number;
  headless: boolean;
};

export function resolveScrapeEnv(env: NodeJS.ProcessEnv = process.env): ScrapeEnv {
  const { statePath, metaPath } = resolveAuthPaths(env);

  return {
    baseUrl: (env.HH_SCRAPE_BASE_URL ?? DEFAULT_SCRAPE_BASE_URL).replace(/\/$/, ""),
    authStatePath: statePath,
    authMetaPath: metaPath,
    searchKeyword: resolveSearchKeyword(env),
    maxSearchPages: Math.min(
      10,
      Math.max(1, Number.parseInt(env.HH_SCRAPE_MAX_PAGES ?? "3", 10) || 3),
    ),
    maxVacanciesDetail: Math.min(
      500,
      Math.max(1, Number.parseInt(env.HH_SCRAPE_MAX_VACANCIES ?? "50", 10) || 50),
    ),
    detailDelayMs: Math.min(
      5000,
      Math.max(200, Number.parseInt(env.HH_SCRAPE_DETAIL_DELAY_MS ?? "800", 10) || 800),
    ),
    headless: env.HH_SCRAPE_HEADLESS !== "false",
  };
}

/** Первая страница выдачи; `text` кодируется автоматически (пробелы, кириллица). */
export function buildSearchUrl(
  baseUrl: string,
  keyword: string,
  options: VacancySearchUrlOptions = {},
): string {
  const params = new URLSearchParams();
  params.set("text", normalizeSearchKeyword(keyword));

  if (options.searchFieldName !== false) {
    params.set("search_field", "name");
  }

  return `${baseUrl}/search/vacancy?${params.toString()}`;
}

export function buildVacancyUrl(baseUrl: string, hhId: string): string {
  return `${baseUrl}/vacancy/${hhId}`;
}
