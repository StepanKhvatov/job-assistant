import { chromium } from "playwright";

import { assertValidHhAuth, HH_AUTH_PROVIDER } from "../playwright/auth.js";
import { buildSearchUrl, resolveScrapeEnv, type ScrapeEnv } from "../playwright/config.js";
import { collectVacanciesFromSearch } from "../playwright/search.js";
import type { ScrapeSyncResult } from "../playwright/types.js";
import { scrapeVacancyDetail } from "../playwright/vacancy-page.js";
import { prisma } from "../db/client.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertScrapedVacancy(
  data: {
    hhId: string;
    title: string;
    company: string | null;
    salary: string | null;
    url: string;
    description: string | null;
    publishedAt: Date | null;
  },
  errors: string[],
) {
  try {
    await prisma.vacancy.upsert({
      where: { hhId: data.hhId },
      create: data,
      update: {
        title: data.title,
        company: data.company,
        salary: data.salary,
        url: data.url,
        description: data.description,
        publishedAt: data.publishedAt,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`hh_id=${data.hhId}: ${msg}`);
  }
}

export async function syncVacanciesFromScrape(
  options?: Partial<ScrapeEnv>,
): Promise<ScrapeSyncResult> {
  const env = { ...resolveScrapeEnv(), ...options };
  const keyword = env.keywords.split(",")[0]?.trim() || "Frontend";
  const searchUrl = buildSearchUrl(env.baseUrl, keyword);

  assertValidHhAuth(env.authStatePath, env.authMetaPath, env.baseUrl);

  console.log(`[job-assistant][${HH_AUTH_PROVIDER}] Using saved session for ${env.baseUrl}`);

  const errors: string[] = [];
  const browser = await chromium.launch({ headless: env.headless });

  try {
    const context = await browser.newContext({
      storageState: env.authStatePath,
      locale: "ru-RU",
      timezoneId: "Asia/Novosibirsk",
    });
    const page = await context.newPage();

    const list = await collectVacanciesFromSearch(page, searchUrl, env.baseUrl, env.maxSearchPages);

    const toProcess = list.slice(0, env.maxVacanciesDetail);
    const skippedOverLimit = Math.max(0, list.length - toProcess.length);
    let upserted = 0;

    for (const item of toProcess) {
      const before = errors.length;
      try {
        const detail = await scrapeVacancyDetail(page, env.baseUrl, item);
        await upsertScrapedVacancy(detail, errors);
        if (errors.length === before) {
          upserted++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`hh_id=${item.hhId}: ${msg}`);
      }
      await sleep(env.detailDelayMs);
    }

    await context.close();

    return {
      keyword,
      searchUrl,
      listCount: list.length,
      detailLimit: env.maxVacanciesDetail,
      upserted,
      skippedOverLimit,
      errors,
    };
  } finally {
    await browser.close();
  }
}
