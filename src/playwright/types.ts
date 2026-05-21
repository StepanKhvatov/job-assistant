export type ScrapedVacancyDetail = {
  hhId: string;
  title: string;
  company: string | null;
  salary: string | null;
  url: string;
  description: string | null;
  publishedAt: Date | null;
};
