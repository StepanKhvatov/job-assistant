import type { Page } from "playwright";

import { buildVacancyUrl } from "./config.js";
import type { ScrapedVacancyListItem } from "./types.js";

const SERP_ROOT = '[data-qa="vacancy-serp__results"], main';

/**
 * Собирает вакансии из выдачи.
 * На hh.ru карточка часто — div с числовым id; дублируем извлечение из href /vacancy/{id}.
 */
export async function collectVacanciesFromSearchPage(
  page: Page,
  baseUrl: string,
): Promise<ScrapedVacancyListItem[]> {
  await page.waitForLoadState("domcontentloaded");

  const root = page.locator(SERP_ROOT).first();
  const hasRoot = (await root.count()) > 0;
  const scope = hasRoot ? root : page.locator("body");

  const raw = await scope.evaluate((el) => {
    const byId = new Map<
      string,
      { title: string | null; company: string | null; salary: string | null }
    >();

    const serpItems = el.querySelectorAll('[data-qa="vacancy-serp__vacancy"], div[id]');
    for (const node of serpItems) {
      const id = node.id?.trim();
      if (!id || !/^\d{6,}$/.test(id)) {
        continue;
      }

      const title =
        node.querySelector('[data-qa="serp-item__title"]')?.textContent?.trim() ||
        node.querySelector("a[data-qa='serp-item__title']")?.textContent?.trim() ||
        node.querySelector("h3")?.textContent?.trim() ||
        null;

      const company =
        node.querySelector('[data-qa="vacancy-serp__vacancy-employer"]')?.textContent?.trim() ||
        node.querySelector('[data-qa="vacancy-serp__vacancy-company"]')?.textContent?.trim() ||
        null;

      const salary =
        node.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]')?.textContent?.trim() ||
        null;

      byId.set(id, { title, company, salary });
    }

    const links = el.querySelectorAll('a[href*="/vacancy/"]');
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      const match = href.match(/\/vacancy\/(\d+)/);
      if (!match) {
        continue;
      }
      const id = match[1];
      if (!byId.has(id)) {
        byId.set(id, {
          title: link.textContent?.trim() || null,
          company: null,
          salary: null,
        });
      }
    }

    return [...byId.entries()].map(([id, meta]) => ({ id, ...meta }));
  });

  return raw.map((row) => ({
    hhId: row.id,
    title: row.title,
    company: row.company,
    salary: row.salary,
    url: buildVacancyUrl(baseUrl, row.id),
  }));
}

export async function collectVacanciesFromSearch(
  page: Page,
  searchUrl: string,
  baseUrl: string,
  maxPages: number,
): Promise<ScrapedVacancyListItem[]> {
  const byId = new Map<string, ScrapedVacancyListItem>();

  await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const batch = await collectVacanciesFromSearchPage(page, baseUrl);
    for (const item of batch) {
      byId.set(item.hhId, item);
    }

    const nextButton = page.locator('[data-qa="pager-next"]');
    if ((await nextButton.count()) === 0) {
      break;
    }

    const disabled = await nextButton.getAttribute("aria-disabled");
    if (disabled === "true") {
      break;
    }

    if (pageIndex + 1 >= maxPages) {
      break;
    }

    await nextButton.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
  }

  return [...byId.values()];
}
