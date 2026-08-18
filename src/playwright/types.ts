import type { JobBoardId } from "../providers/types.js";

/**
 * Нормализованная карточка после scrape. `id` в БД — внутренний cuid;
 * здесь только id на борде (`externalId`) и `provider`.
 */
export type ScrapedVacancyDetail = {
  provider: JobBoardId;
  externalId: string;
  title: string;
  company: string | null;
  salary: string | null;
  url: string;
  description: string | null;
  publishedAt: Date | null;
};

export type SearchCollectionResult = {
  ids: string[];
  totalReported: number | null;
  totalPages: number;
  pagesVisited: number;
};

export type SessionAlive = {
  url: string;
};
