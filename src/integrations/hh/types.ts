export type HhSalary = {
  from?: number | null;
  to?: number | null;
  currency?: string | null;
  gross?: boolean | null;
} | null;

export type HhEmployer = {
  name?: string | null;
} | null;

export type HhVacancySnippet = {
  requirement?: string | null;
  responsibility?: string | null;
};

export type HhVacancyListItem = {
  id: string;
  name: string;
  alternate_url: string;
  published_at?: string | null;
  employer?: HhEmployer;
  salary?: HhSalary;
  snippet?: HhVacancySnippet | null;
};

export type HhVacanciesSearchResponse = {
  items: HhVacancyListItem[];
  pages: number;
  page: number;
  per_page: number;
  found: number;
};

export type HhVacancyDetail = {
  id: string;
  name: string;
  alternate_url: string;
  published_at?: string | null;
  employer?: HhEmployer;
  salary?: HhSalary;
  description?: string | null;
};
