import type { Page } from "playwright";

import { buildSearchUrl } from "./config.js";
import { logInfo } from "../utils/log.js";

const SERP_ROOT = '[data-qa="vacancy-serp__results"], main';
const PAGER_NEXT = 'a[data-qa="pager-next"]';

async function hasPagerNext(page: Page): Promise<boolean> {
  const link = page.locator(PAGER_NEXT);
  if ((await link.count()) === 0) {
    return false;
  }
  return (await link.first().getAttribute("aria-disabled")) !== "true";
}

export async function collectVacancyIdsFromSearchPage(page: Page): Promise<string[]> {
  await page.waitForLoadState("domcontentloaded");

  const root = page.locator(SERP_ROOT).first();
  const scope = (await root.count()) > 0 ? root : page.locator("body");

  return scope.evaluate((el) => {
    const ids = new Set<string>();

    for (const node of el.querySelectorAll('[data-qa="vacancy-serp__vacancy"], div[id]')) {
      const id = node.id?.trim();
      if (id && /^\d{6,}$/.test(id)) {
        ids.add(id);
      }
    }

    for (const link of el.querySelectorAll('a[href*="/vacancy/"]')) {
      const match = (link.getAttribute("href") ?? "").match(/\/vacancy\/(\d+)/);
      if (match) {
        ids.add(match[1]);
      }
    }

    return [...ids];
  });
}

/**
 * URL с ?text=, затем клик pager-next, пока ссылка есть.
 *
 * TODO: id собираются неполно — дедуп, wait после pager-next, лимит страниц.
 */
export async function collectVacancyIdsFromSearch(
  page: Page,
  baseUrl: string,
  keyword: string,
  maxPages: number,
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();

  await page.goto(buildSearchUrl(baseUrl, keyword), { waitUntil: "domcontentloaded" });

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const batch = await collectVacancyIdsFromSearchPage(page);
    let added = 0;
    for (const id of batch) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
        added++;
      }
    }

    logInfo(`search page ${pageIndex + 1}: +${added} ids (total ${ids.length})`);

    if (batch.length === 0 || !(await hasPagerNext(page)) || pageIndex + 1 >= maxPages) {
      break;
    }

    await page.locator(PAGER_NEXT).first().click();
    await page.waitForLoadState("domcontentloaded");
  }

  return ids;
}
