import { CANDIDATE_PROFILE } from "../config/candidate-profile.js";
import { resolveAuthPaths } from "./auth.js";

export const DEFAULT_SCRAPE_BASE_URL = "https://novosibirsk.hh.ru";
export { DEFAULT_AUTH_STATE_PATH, DEFAULT_AUTH_META_PATH, HH_AUTH_PROVIDER } from "./auth.js";

export type ScrapeEnv = {
  baseUrl: string;
  authStatePath: string;
  authMetaPath: string;
  keywords: string;
  maxSearchPages: number;
  maxVacanciesDetail: number;
  detailDelayMs: number;
  headless: boolean;
};

export function resolveScrapeEnv(env: NodeJS.ProcessEnv = process.env): ScrapeEnv {
  const keywords =
    env.HH_SCRAPE_KEYWORDS?.trim() ||
    env.HH_KEYWORDS?.trim() ||
    CANDIDATE_PROFILE.defaultHhKeywords.join(",");

  const { statePath, metaPath } = resolveAuthPaths(env);

  return {
    baseUrl: (env.HH_SCRAPE_BASE_URL ?? DEFAULT_SCRAPE_BASE_URL).replace(/\/$/, ""),
    authStatePath: statePath,
    authMetaPath: metaPath,
    keywords,
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

export function buildSearchUrl(baseUrl: string, keyword: string): string {
  const params = new URLSearchParams();
  params.set("text", keyword.trim());
  params.set("search_field", "name");
  params.set("enable_snippets", "false");
  return `${baseUrl}/search/vacancy?${params.toString()}`;
}

export function buildVacancyUrl(baseUrl: string, hhId: string): string {
  return `${baseUrl}/vacancy/${hhId}`;
}
