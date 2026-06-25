import { prisma } from "../db/client.js";
import type { ScrapedVacancyDetail } from "../playwright/types.js";
import { logDbFail, logDbOk } from "../utils/log.js";

export async function findExistingVacancyHhIds(hhIds: string[]): Promise<Set<string>> {
  if (hhIds.length === 0) {
    return new Set();
  }

  const rows = await prisma.vacancy.findMany({
    where: { hhId: { in: hhIds } },
    select: { hhId: true },
  });

  return new Set(rows.map((row) => row.hhId));
}

export async function upsertScrapedVacancy(detail: ScrapedVacancyDetail): Promise<boolean> {
  try {
    await prisma.vacancy.upsert({
      where: { hhId: detail.hhId },
      create: {
        hhId: detail.hhId,
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
    logDbOk(detail.hhId, detail.title);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logDbFail(detail.hhId, msg);
    return false;
  }
}
