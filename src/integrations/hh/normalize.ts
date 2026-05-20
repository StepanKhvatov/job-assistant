import type { HhSalary, HhVacancyDetail, HhVacancyListItem } from "./types.js";

export function formatHhSalary(salary: HhSalary | undefined): string | null {
  if (!salary) {
    return null;
  }

  const from = salary.from;
  const to = salary.to;
  let range: string | null = null;

  if (from != null && to != null) {
    range = `${from}–${to}`;
  } else if (from != null) {
    range = `от ${from}`;
  } else if (to != null) {
    range = `до ${to}`;
  }

  if (!range) {
    return null;
  }

  const cur = salary.currency ? ` ${salary.currency}` : "";
  const gross = salary.gross === true ? " gross" : salary.gross === false ? " net" : "";
  return `${range}${cur}${gross}`.trim();
}

export function buildSearchTextFromKeywords(keywords: string[]): string {
  const cleaned = keywords.map((k) => k.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return "";
  }
  if (cleaned.length === 1) {
    return cleaned[0];
  }
  return cleaned.map((k) => `(${k})`).join(" OR ");
}

export function snippetFallback(item: HhVacancyListItem): string | null {
  const s = item.snippet;
  if (!s) {
    return null;
  }
  const parts = [s.requirement, s.responsibility].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

export function mapListItemToDbFields(item: HhVacancyListItem, description: string | null) {
  return {
    hhId: item.id,
    title: item.name,
    company: item.employer?.name ?? null,
    salary: formatHhSalary(item.salary),
    url: item.alternate_url,
    description,
    publishedAt: item.published_at ? new Date(item.published_at) : null,
  };
}

export function descriptionFromDetail(detail: HhVacancyDetail): string | null {
  return detail.description ?? null;
}
