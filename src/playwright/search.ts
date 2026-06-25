import type { Page } from "playwright";

import { buildSearchUrl } from "./config.js";
import { logInfo } from "../utils/log.js";

const SERP_ROOT = '[data-qa="vacancy-serp__results"], main';
const VACANCY_CARD = '[data-qa="vacancy-serp__vacancy"]';
const PAGER_BLOCK = '[data-qa="pager-block"]';

export const HH_SEARCH_ITEMS_PER_PAGE = 50;

export type SearchCollectionResult = {
  ids: string[];
  totalReported: number | null;
  totalPages: number;
  pagesVisited: number;
};

/** «Найдено 1 234 вакансии» из текста `<p>` или заголовка. */
export function parseTotalVacanciesText(text: string): number | null {
  const normalized = text.replace(/\u00a0/g, " ").trim();
  const match = normalized.match(/Найдено\s+([\d\s]+)\s+ваканс/i);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1].replace(/\s/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

export async function readSearchTitleText(page: Page): Promise<string | null> {
  const title = page.locator('[data-qa="title"]').first();
  if ((await title.count()) === 0) {
    return null;
  }

  const text = (await title.textContent())?.replace(/\u00a0/g, " ").trim();
  return text || null;
}

export async function parseSearchResultTotal(page: Page): Promise<number | null> {
  const titleText = await readSearchTitleText(page);
  if (titleText) {
    const value = parseTotalVacanciesText(titleText);
    if (value !== null) {
      return value;
    }
  }

  return page.evaluate(() => {
    const title = document.querySelector('[data-qa="title"]');
    if (title?.textContent) {
      const normalized = title.textContent.replace(/\u00a0/g, " ").trim();
      const match = normalized.match(/Найдено\s+([\d\s]+)\s+ваканс/i);
      if (match) {
        const value = Number.parseInt(match[1].replace(/\s/g, ""), 10);
        if (Number.isFinite(value)) {
          return value;
        }
      }
    }

    for (const p of document.querySelectorAll("p")) {
      const text = p.textContent;
      if (!text) {
        continue;
      }
      const normalized = text.replace(/\u00a0/g, " ").trim();
      const match = normalized.match(/Найдено\s+([\d\s]+)\s+ваканс/i);
      if (!match) {
        continue;
      }
      const value = Number.parseInt(match[1].replace(/\s/g, ""), 10);
      if (Number.isFinite(value)) {
        return value;
      }
    }

    for (const el of document.querySelectorAll("h1, h2, [data-qa='title']")) {
      const text = el.textContent;
      if (!text) {
        continue;
      }
      const normalized = text.replace(/\u00a0/g, " ").trim();
      const match = normalized.match(/Найдено\s+([\d\s]+)\s+ваканс/i);
      if (!match) {
        continue;
      }
      const value = Number.parseInt(match[1].replace(/\s/g, ""), 10);
      if (Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  });
}

export async function parseSearchResultPages(page: Page): Promise<number> {
  const totalReported = await parseSearchResultTotal(page);
  if (totalReported && totalReported > 0) {
    return Math.max(1, Math.ceil(totalReported / HH_SEARCH_ITEMS_PER_PAGE));
  }

  const fromPager = await page.locator(PAGER_BLOCK).evaluate((el) => {
    const values = [...el.querySelectorAll('a[data-qa="pager-page"]')]
      .map((link) => {
        const textValue = Number.parseInt(link.textContent?.trim() ?? "", 10);
        const href = link.getAttribute("href") ?? "";
        const url = new URL(href, window.location.origin);
        const pageParam = Number.parseInt(url.searchParams.get("page") ?? "", 10);
        const hrefValue = Number.isFinite(pageParam) ? pageParam + 1 : Number.NaN;
        return Math.max(textValue, hrefValue);
      })
      .filter((value) => Number.isFinite(value));

    return values.length > 0 ? Math.max(...values) : 1;
  }).catch(() => null);

  if (fromPager && fromPager > 0) {
    return fromPager;
  }

  return 1;
}

export async function collectVacancyIdsFromSearchPage(page: Page): Promise<string[]> {
  await page.locator(VACANCY_CARD).first().waitFor({ state: "attached", timeout: 15_000 });

  const root = page.locator(SERP_ROOT).first();
  const scope = (await root.count()) > 0 ? root : page.locator("body");

  return scope.evaluate((el, cardSelector) => {
    const ids = new Set<string>();

    for (const node of el.querySelectorAll(cardSelector)) {
      const numericId = node.id?.trim();
      if (numericId && /^\d{6,}$/.test(numericId)) {
        ids.add(numericId);
      }

      for (const link of node.querySelectorAll('a[href*="/vacancy/"]')) {
        const match = (link.getAttribute("href") ?? "").match(/\/vacancy\/(\d+)/);
        if (match) {
          ids.add(match[1]);
        }
      }
    }

    return [...ids];
  }, VACANCY_CARD);
}

async function getFirstVacancyId(page: Page): Promise<string | null> {
  const ids = await collectVacancyIdsFromSearchPage(page);
  return ids[0] ?? null;
}

async function waitForSearchResults(page: Page, previousFirstId: string | null): Promise<void> {
  await page.locator(VACANCY_CARD).first().waitFor({ state: "visible", timeout: 15_000 });

  if (!previousFirstId) {
    return;
  }

  try {
    await page.waitForFunction(
      ({ prev, cardSelector }) => {
        const card = document.querySelector(cardSelector);
        if (!card) {
          return false;
        }
        const link = card.querySelector('a[href*="/vacancy/"]');
        const href = link?.getAttribute("href") ?? "";
        const match = href.match(/\/vacancy\/(\d+)/);
        const id = match?.[1] ?? card.id;
        return Boolean(id && id !== prev);
      },
      { prev: previousFirstId, cardSelector: VACANCY_CARD },
      { timeout: 15_000 },
    );
  } catch {
    /* редкий случай: первая карточка совпала между страницами */
  }
}

async function goToSearchPage(
  page: Page,
  targetPage: number,
  previousFirstId: string | null,
): Promise<void> {
  const nextUrl = new URL(page.url());
  nextUrl.searchParams.set("page", String(targetPage - 1));

  await page.goto(nextUrl.toString(), { waitUntil: "domcontentloaded" });
  await waitForSearchResults(page, previousFirstId);
}

/**
 * Поиск по `?text=`, обход номеров страниц pager-page с первой по последнюю.
 * Дедуп id в памяти; число страниц читается из блока пагинации.
 */
export async function collectVacancyIdsFromSearch(
  page: Page,
  baseUrl: string,
  keyword: string,
): Promise<SearchCollectionResult> {
  const ids: string[] = [];
  const seen = new Set<string>();

  await page.goto(buildSearchUrl(baseUrl, keyword), { waitUntil: "domcontentloaded" });
  await waitForSearchResults(page, null);

  const titleText = await readSearchTitleText(page);
  const totalReported = await parseSearchResultTotal(page);
  const totalPages = await parseSearchResultPages(page);

  if (titleText) {
    logInfo(`search title="${titleText}"`);
  } else {
    logInfo("search title not found");
  }
  logInfo(`search total reported=${totalReported ?? "?"} total_pages=${totalPages}`);

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const batch = await collectVacancyIdsFromSearchPage(page);
    let added = 0;
    for (const id of batch) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
        added++;
      }
    }

    logInfo(`search page ${pageIndex + 1}/${totalPages}: +${added} ids (total ${ids.length})`);

    const isLastPlannedPage = pageIndex + 1 >= totalPages;
    if (batch.length === 0 || isLastPlannedPage) {
      return {
        ids,
        totalReported,
        totalPages,
        pagesVisited: pageIndex + 1,
      };
    }

    const previousFirstId = batch[0] ?? (await getFirstVacancyId(page));
    await goToSearchPage(page, pageIndex + 2, previousFirstId);
  }

  return {
    ids,
    totalReported,
    totalPages,
    pagesVisited: totalPages,
  };
}
