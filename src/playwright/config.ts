import { getEnv } from "../config/env.js";
import { HH_BOARD, hhSearchUrl, hhVacancyUrl } from "../providers/hh.js";
import { requireActiveJobBoard, type JobBoardId } from "../providers/index.js";
import { resolveAuthPaths } from "./auth.js";

export const DEFAULT_SCRAPE_BASE_URL = HH_BOARD.defaultSiteUrl;
export { DEFAULT_AUTH_STATE_PATH, DEFAULT_AUTH_META_PATH, HH_AUTH_PROVIDER } from "./auth.js";

export type ScrapeEnv = {
  boardId: JobBoardId;
  baseUrl: string;
  authStatePath: string;
  authMetaPath: string;
  searchKeywords: string[];
  detailDelayMs: number;
  headless: boolean;
};

export function resolveScrapeEnv(
  boardId: JobBoardId = "hh",
  overrides?: Partial<ScrapeEnv>,
): ScrapeEnv {
  const board = requireActiveJobBoard(boardId);
  const e = getEnv();
  const { statePath, metaPath } = resolveAuthPaths(boardId);

  const baseUrl = boardId === "hh" ? e.HH_BASE_URL : board.defaultSiteUrl;

  return {
    boardId,
    baseUrl,
    authStatePath: statePath,
    authMetaPath: metaPath,
    searchKeywords: e.HH_SEARCH_KEYWORDS,
    detailDelayMs: e.SCRAPE_DELAY_MS ?? board.limits.scrapeDelayMs,
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
