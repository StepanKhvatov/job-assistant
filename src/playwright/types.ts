export type ScrapedVacancyDetail = {
  hhId: string;
  title: string;
  company: string | null;
  salary: string | null;
  url: string;
  description: string | null;
  publishedAt: Date | null;
};

export type ScrapeSyncResult = {
  keyword: string;
  searchUrl: string;
  listCount: number;
  detailLimit: number;
  upserted: number;
  skippedOverLimit: number;
  errors: string[];
};
