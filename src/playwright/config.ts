import { getEnv } from "../config/env.js";
import { HH_BOARD, hhSearchUrl, hhVacancyUrl } from "../providers/hh.js";
import { resolveAuthPaths } from "./auth.js";

export const DEFAULT_SCRAPE_BASE_URL = HH_BOARD.defaultSiteUrl;
export { DEFAULT_AUTH_STATE_PATH, DEFAULT_AUTH_META_PATH, HH_AUTH_PROVIDER } from "./auth.js";

export type ScrapeEnv = {
  baseUrl: string;
  authStatePath: string;
  authMetaPath: string;
  searchKeyword: string;
  detailDelayMs: number;
  headless: boolean;
};

export function resolveScrapeEnv(overrides?: Partial<ScrapeEnv>): ScrapeEnv {
  const e = getEnv();
  const { statePath, metaPath } = resolveAuthPaths();

  return {
    baseUrl: e.HH_BASE_URL,
    authStatePath: statePath,
    authMetaPath: metaPath,
    searchKeyword: e.HH_SEARCH_KEYWORD,
    detailDelayMs: e.SCRAPE_DELAY_MS,
    headless: e.HEADLESS,
    ...overrides,
  };
}

/** Поисковая выдача hh.ru. Параметры — `src/providers/hh.ts`. */
export function buildSearchUrl(baseUrl: string, keyword: string): string {
  return hhSearchUrl(baseUrl, keyword);
}

export function buildVacancyUrl(baseUrl: string, externalId: string): string {
  return hhVacancyUrl(baseUrl, externalId);
}
