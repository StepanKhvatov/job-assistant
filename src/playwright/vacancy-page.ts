import type { Page } from "playwright";

import { buildVacancyUrl } from "./config.js";
import type { ScrapedVacancyDetail } from "./types.js";

/** Стабильные data-qa — см. docs/VACANCY_PAGE_SELECTORS.md */
const SEL = {
  title: '[data-qa="vacancy-title"]',
  company: '[data-qa="vacancy-company-name"]',
  salary: '[data-qa="vacancy-salary"]',
  description: '[data-qa="vacancy-description"]',
  brandedDescription: '[data-qa="vacancy-branded-description-content"]',
  published: '[data-qa="vacancy-creation-time"], [data-qa="vacancy-view-creation-date"]',
  meta: 'meta[name="description"]',
} as const;

function parsePublishedAt(text: string | null | undefined): Date | null {
  if (!text?.trim()) {
    return null;
  }

  const normalized = text.replace(/\u00a0/g, " ").trim();
  const dmy = normalized.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dmy) {
    const parsed = Date.parse(`${dmy[3]}-${dmy[2]}-${dmy[1]}T12:00:00`);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

export async function scrapeVacancyDetailById(
  page: Page,
  baseUrl: string,
  hhId: string,
): Promise<ScrapedVacancyDetail> {
  const url = buildVacancyUrl(baseUrl, hhId);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator(SEL.title).first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});

  const data = await page.evaluate((s) => {
    const title =
      document.querySelector(s.title)?.textContent?.trim() ||
      document.querySelector("h1")?.textContent?.trim() ||
      null;

    const company =
      document.querySelector(s.company)?.textContent?.trim() ||
      document.querySelector('[data-qa="vacancy-company"] a')?.textContent?.trim() ||
      null;

    let salary = document.querySelector(s.salary)?.textContent?.trim() || null;
    if (!salary) {
      const header = document.querySelector(s.title)?.parentElement;
      for (const span of header?.querySelectorAll("span") ?? []) {
        const t = span.textContent?.trim();
        if (t && (t.includes("доход") || t.includes("₽") || /\d/.test(t))) {
          salary = t;
          break;
        }
      }
    }
    if (!salary) {
      const meta = document.querySelector(s.meta)?.getAttribute("content");
      const m = meta?.match(/Зарплата:\s*([^.]+)/);
      if (m?.[1]) {
        salary = m[1].trim();
      }
    }

    const description =
      (
        document.querySelector(s.description) ||
        document.querySelector(s.brandedDescription)
      )?.textContent?.trim() || null;

    let publishedRaw =
      document.querySelector('[data-qa="vacancy-creation-time"]')?.textContent?.trim() ||
      document.querySelector('[data-qa="vacancy-view-creation-date"]')?.textContent?.trim() ||
      null;

    if (!publishedRaw) {
      const meta = document.querySelector(s.meta)?.getAttribute("content");
      const m = meta?.match(/Дата публикации:\s*(\d{2}\.\d{2}\.\d{4})/);
      if (m?.[1]) {
        publishedRaw = m[1];
      }
    }
    if (!publishedRaw) {
      const m = document.documentElement.innerHTML.match(
        /"publicationTime":\{"@timestamp":\d+,"\$":"([^"]+)"/,
      );
      if (m?.[1]) {
        publishedRaw = m[1];
      }
    }

    return { title, company, salary, description, publishedRaw };
  }, SEL);

  return {
    hhId,
    title: data.title ?? "Без названия",
    company: data.company,
    salary: data.salary,
    url,
    description: data.description,
    publishedAt: parsePublishedAt(data.publishedRaw),
  };
}
