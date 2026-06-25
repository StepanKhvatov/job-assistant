import { getEnv } from "../config/env.js";
import { resolveAuthPaths } from "./auth.js";

export const DEFAULT_SCRAPE_BASE_URL = "https://novosibirsk.hh.ru";
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

export function buildSearchUrl(baseUrl: string, keyword: string): string {
  const params = new URLSearchParams();
  params.set("text", keyword.trim());
  params.set("search_field", "name");
  params.set("items_on_page", "50");
  return `${baseUrl}/search/vacancy?${params.toString()}`;
}

export function buildVacancyUrl(baseUrl: string, hhId: string): string {
  return `${baseUrl}/vacancy/${hhId}`;
}
