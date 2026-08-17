import { prisma } from "../db/client.js";
import type { JobBoardId } from "../providers/types.js";
import type { ScrapedVacancyDetail } from "../playwright/types.js";
import { logDbFail, logDbOk } from "../utils/log.js";

export type ExistingVacancyScrapeState = {
  /** Есть описание — карточку не открываем */
  skip: Set<string>;
  /** Строка есть, description пустой — перепарсим */
  refresh: Set<string>;
};

export async function findExistingVacancyScrapeState(
  provider: JobBoardId,
  externalIds: string[],
): Promise<ExistingVacancyScrapeState> {
  const skip = new Set<string>();
  const refresh = new Set<string>();
  if (externalIds.length === 0) {
    return { skip, refresh };
  }

  const rows = await prisma.vacancy.findMany({
    where: { provider, externalId: { in: externalIds } },
    select: { externalId: true, description: true },
  });

  for (const row of rows) {
    if (row.description?.trim()) {
      skip.add(row.externalId);
    } else {
      refresh.add(row.externalId);
    }
  }

  return { skip, refresh };
}

export async function upsertScrapedVacancy(detail: ScrapedVacancyDetail): Promise<boolean> {
  try {
    await prisma.vacancy.upsert({
      where: {
        provider_externalId: {
          provider: detail.provider,
          externalId: detail.externalId,
        },
      },
      create: {
        provider: detail.provider,
        externalId: detail.externalId,
        title: detail.title,
        company: detail.company,
        salary: detail.salary,
        url: detail.url,
        description: detail.description,
        publishedAt: detail.publishedAt,
      },
      update: {
        title: detail.title,
        company: detail.company,
        salary: detail.salary,
        url: detail.url,
        description: detail.description,
        publishedAt: detail.publishedAt,
      },
    });
    logDbOk(detail.provider, detail.externalId, detail.title);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logDbFail(detail.provider, detail.externalId, msg);
    return false;
  }
}
