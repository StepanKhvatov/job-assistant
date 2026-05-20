import type { Page } from "playwright";

import { buildVacancyUrl } from "./config.js";
import type { ScrapedVacancyDetail, ScrapedVacancyListItem } from "./types.js";

function parsePublishedAt(text: string | null | undefined): Date | null {
  if (!text?.trim()) {
    return null;
  }
  const normalized = text.replace(/\u00a0/g, " ").trim();
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed);
}

export async function scrapeVacancyDetail(
  page: Page,
  baseUrl: string,
  listItem: ScrapedVacancyListItem,
): Promise<ScrapedVacancyDetail> {
  const url = buildVacancyUrl(baseUrl, listItem.hhId);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const data = await page.evaluate(() => {
    const title =
      document.querySelector('[data-qa="vacancy-title"]')?.textContent?.trim() ||
      document.querySelector("h1")?.textContent?.trim() ||
      null;

    const company =
      document.querySelector('[data-qa="vacancy-company-name"]')?.textContent?.trim() ||
      document.querySelector('[data-qa="vacancy-company"] a')?.textContent?.trim() ||
      null;

    const salary =
      document.querySelector('[data-qa="vacancy-salary"]')?.textContent?.trim() || null;

    const descriptionEl =
      document.querySelector('[data-qa="vacancy-description"]') ||
      document.querySelector('[data-qa="vacancy-branded-description-content"]');

    const description = descriptionEl?.textContent?.trim() || null;

    const publishedRaw =
      document.querySelector('[data-qa="vacancy-creation-time"]')?.textContent?.trim() ||
      document.querySelector('[data-qa="vacancy-view-creation-date"]')?.textContent?.trim() ||
      null;

    return { title, company, salary, description, publishedRaw };
  });

  return {
    hhId: listItem.hhId,
    title: data.title ?? listItem.title ?? "Без названия",
    company: data.company ?? listItem.company,
    salary: data.salary ?? listItem.salary,
    url,
    description: data.description,
    publishedAt: parsePublishedAt(data.publishedRaw),
  };
}
