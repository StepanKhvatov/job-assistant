import { CANDIDATE_PROFILE } from "../config/candidate-profile.js";

/**
 * Один поисковый запрос для Playwright (`?text=`).
 * Не путать с HH_KEYWORDS / HH_SCRAPE_KEYWORDS — там список через запятую для API (OR).
 *
 * Приоритет:
 * 1. HH_SCRAPE_KEYWORD — явная фраза для скрапинга
 * 2. HH_SEARCH_TEXT — полная строка (как в UI hh.ru)
 * 3. первое слово из HH_SCRAPE_KEYWORDS / HH_KEYWORDS (legacy)
 * 4. CANDIDATE_PROFILE.defaultScrapeKeyword
 */
export function resolveSearchKeyword(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.HH_SCRAPE_KEYWORD?.trim() || env.HH_SEARCH_TEXT?.trim();
  if (explicit) {
    return normalizeSearchKeyword(explicit);
  }

  const legacyList = env.HH_SCRAPE_KEYWORDS?.trim() || env.HH_KEYWORDS?.trim();
  if (legacyList) {
    const first = legacyList.split(",")[0]?.trim();
    if (first) {
      return normalizeSearchKeyword(first);
    }
  }

  return normalizeSearchKeyword(CANDIDATE_PROFILE.defaultScrapeKeyword);
}

/** Trim, одна пробельная последовательность, Unicode NFC (кириллица). */
export function normalizeSearchKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").normalize("NFC");
}
