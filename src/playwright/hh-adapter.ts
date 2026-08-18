import { hhSearchUrl, hhVacancyUrl, HH_BOARD } from "../providers/hh.js";
import { applyToVacancy } from "./apply.js";
import type { JobBoardPlaywrightAdapter } from "./adapter.js";
import { assertValidHhAuth } from "./auth.js";
import { assertHhSessionOnPage } from "./auth-session.js";
import { collectVacancyIdsFromSearch } from "./search.js";
import { scrapeVacancyDetailById } from "./vacancy-page.js";

/** HH-реализация контракта. LinkedIn — отдельный объект, не наследник. */
export const hhPlaywrightAdapter: JobBoardPlaywrightAdapter = {
  board: HH_BOARD,
  assertValidAuth: assertValidHhAuth,
  verifySession: async (page, baseUrl) => {
    const session = await assertHhSessionOnPage(page, baseUrl);
    return { url: session.url };
  },
  collectSearchIds: collectVacancyIdsFromSearch,
  scrapeDetail: scrapeVacancyDetailById,
  applyToVacancy,
  buildSearchUrl: hhSearchUrl,
  buildVacancyUrl: hhVacancyUrl,
};
