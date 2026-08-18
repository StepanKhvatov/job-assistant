/**
 * Playwright-адаптер джоб-борда.
 *
 * Не abstract class и не наследование от Page: у HH и LinkedIn разная
 * вёрстка, разные доказательства сессии и разный apply. Общий каркас —
 * функции в `src/services/*`, которые вызывают этот объект.
 *
 * Добавить сервис = реализовать `JobBoardPlaywrightAdapter` и зарегистрировать
 * в `PLAYWRIGHT_ADAPTERS`. Методы LinkedIn пока не пишем: борд `planned`.
 */
import type { Page } from "playwright";

import { requireActiveJobBoard, type JobBoardId, type JobBoardSchema } from "../providers/index.js";
import type { ApplyToVacancyResult } from "./apply.js";
import { hhPlaywrightAdapter } from "./hh-adapter.js";
import type { ScrapedVacancyDetail, SearchCollectionResult, SessionAlive } from "./types.js";

export type JobBoardPlaywrightAdapter = {
  readonly board: JobBoardSchema;
  assertValidAuth(statePath: string, metaPath: string, expectedBaseUrl?: string): void;
  verifySession(page: Page, baseUrl: string): Promise<SessionAlive>;
  collectSearchIds(page: Page, baseUrl: string, keyword: string): Promise<SearchCollectionResult>;
  scrapeDetail(page: Page, baseUrl: string, externalId: string): Promise<ScrapedVacancyDetail>;
  applyToVacancy(
    page: Page,
    baseUrl: string,
    externalId: string,
    coverLetter: string,
  ): Promise<ApplyToVacancyResult>;
  buildSearchUrl(baseUrl: string, keyword: string): string;
  buildVacancyUrl(baseUrl: string, externalId: string): string;
};

const PLAYWRIGHT_ADAPTERS: Partial<Record<JobBoardId, JobBoardPlaywrightAdapter>> = {
  hh: hhPlaywrightAdapter,
};

export function getPlaywrightAdapter(id: JobBoardId): JobBoardPlaywrightAdapter {
  requireActiveJobBoard(id);
  const adapter = PLAYWRIGHT_ADAPTERS[id];
  if (!adapter) {
    throw new Error(
      `${id} Playwright adapter is not registered. See docs/PROVIDERS.md (LinkedIn TODO)`,
    );
  }
  return adapter;
}
