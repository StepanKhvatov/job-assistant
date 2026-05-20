import { CANDIDATE_PROFILE } from "../config/candidate-profile.js";
import { HhApiClient } from "../integrations/hh/client.js";
import {
  HH_AREA_NOVOSIBIRSK,
  HH_AREA_RUSSIA,
  HH_DEFAULT_MAX_PAGES,
} from "../integrations/hh/constants.js";
import {
  buildSearchTextFromKeywords,
  descriptionFromDetail,
  mapListItemToDbFields,
  snippetFallback,
} from "../integrations/hh/normalize.js";
import type { HhVacancyListItem } from "../integrations/hh/types.js";
import { prisma } from "../db/client.js";

export type VacancySyncOptions = {
  searchText: string;
  userAgent: string;
  baseUrl?: string;
  maxPagesPerQuery?: number;
  detailDelayMs?: number;
  /** Офлайн-вакансии в Новосибирске */
  includeOfficeNovosibirsk?: boolean;
  /** Удалёнка по всей России */
  includeRemoteRussia?: boolean;
  /** Лимит вакансий с запросом полного описания за один прогон */
  maxVacanciesDetail?: number;
};

export type VacancySyncResult = {
  /** Число позиций в выдаче «офис Новосибирск» до дедупа с удалёнкой */
  officeCount: number;
  /** Число позиций в выдаче «удалёнка Россия» до дедупа */
  remoteCount: number;
  uniqueListCount: number;
  detailLimit: number;
  upserted: number;
  skippedOverLimit: number;
  errors: string[];
};

async function upsertVacancyFromHh(client: HhApiClient, item: HhVacancyListItem, errors: string[]) {
  try {
    const detail = await client.fetchVacancyDetail(item.id);
    const description = descriptionFromDetail(detail) ?? snippetFallback(item);

    const data = mapListItemToDbFields(
      {
        ...item,
        name: detail.name ?? item.name,
        alternate_url: detail.alternate_url ?? item.alternate_url,
        published_at: detail.published_at ?? item.published_at,
        employer: detail.employer ?? item.employer,
        salary: detail.salary ?? item.salary,
      },
      description,
    );

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
    errors.push(`hh_id=${item.id}: ${msg}`);
  }
}

export async function syncVacanciesFromHh(options: VacancySyncOptions): Promise<VacancySyncResult> {
  const client = new HhApiClient({
    baseUrl: options.baseUrl,
    userAgent: options.userAgent,
    detailDelayMs: options.detailDelayMs,
  });

  const maxPages = options.maxPagesPerQuery ?? HH_DEFAULT_MAX_PAGES;
  const errors: string[] = [];
  const byId = new Map<string, HhVacancyListItem>();

  let officeCount = 0;
  let remoteCount = 0;

  if (options.includeOfficeNovosibirsk !== false) {
    const office = await client.collectSearchPages({
      text: options.searchText,
      area: HH_AREA_NOVOSIBIRSK,
      maxPages,
    });
    officeCount = office.length;
    for (const v of office) {
      byId.set(v.id, v);
    }
  }

  if (options.includeRemoteRussia !== false) {
    const remote = await client.collectSearchPages({
      text: options.searchText,
      area: HH_AREA_RUSSIA,
      schedule: "remote",
      maxPages,
    });
    remoteCount = remote.length;
    for (const v of remote) {
      byId.set(v.id, v);
    }
  }

  const list = [...byId.values()].sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });

  const detailLimit = Math.min(
    2000,
    Math.max(1, options.maxVacanciesDetail ?? 200),
  );
  const toProcess = list.slice(0, detailLimit);
  const skippedOverLimit = Math.max(0, list.length - toProcess.length);

  let upserted = 0;

  for (const item of toProcess) {
    const before = errors.length;
    await upsertVacancyFromHh(client, item, errors);
    if (errors.length === before) {
      upserted++;
    }
  }

  return {
    officeCount,
    remoteCount,
    uniqueListCount: list.length,
    detailLimit,
    upserted,
    skippedOverLimit,
    errors,
  };
}

export function resolveSearchTextFromEnv(env: {
  HH_SEARCH_TEXT?: string;
  HH_KEYWORDS?: string;
}): string {
  const explicit = env.HH_SEARCH_TEXT?.trim();
  if (explicit) {
    return explicit;
  }

  const raw = env.HH_KEYWORDS?.trim();
  if (raw) {
    const keywords = raw.split(",").map((k) => k.trim()).filter(Boolean);
    return buildSearchTextFromKeywords(keywords);
  }

  return buildSearchTextFromKeywords([...CANDIDATE_PROFILE.defaultHhKeywords]);
}
