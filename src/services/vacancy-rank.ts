/**
 * DeepSeek-ранжирование. Не знает про HH/LinkedIn: на входе строка описания.
 */
import type { RankEnv } from "../config/rank-env.js";
import { resolveRankEnv } from "../config/rank-env.js";
import { prisma } from "../db/client.js";
import type { Vacancy } from "../generated/prisma/client.js";
import { rankVacancyWithDeepSeek } from "../integrations/deepseek/client.js";
import type { VacancyRankModelResult } from "../integrations/deepseek/types.js";
import { buildRankVacancyMessages } from "../prompts/rank-vacancy.js";
import { logInfo, vacancyRef } from "../utils/log.js";
import { sleep } from "../utils/sleep.js";
import { truncate } from "../utils/text.js";
import { cleanupStaleVacanciesIfInline, type RetentionCleanupResult } from "./vacancy-retention.js";

export type RankSyncResult = {
  candidates: number;
  ranked: number;
  skippedNoDescription: number;
  retention: RetentionCleanupResult;
  errors: string[];
};

function vacancyToRankInput(v: Vacancy, maxChars: number) {
  const description = v.description?.trim();
  if (!description) {
    return null;
  }

  return {
    provider: v.provider,
    externalId: v.externalId,
    title: v.title,
    company: v.company,
    salary: v.salary,
    url: v.url,
    description: truncate(description, maxChars),
  };
}

async function saveAnalysis(vacancy: Vacancy, result: VacancyRankModelResult) {
  await prisma.analysis.create({
    data: {
      vacancyId: vacancy.id,
      score: result.score,
      summary: result.summary || null,
      pros: result.pros,
      cons: result.cons,
    },
  });
  logInfo(`ai ok ${vacancyRef(vacancy.provider, vacancy.externalId)} score=${result.score}`);
}

export async function rankUnanalyzedVacancies(
  options?: Partial<RankEnv>,
): Promise<RankSyncResult> {
  const env = { ...resolveRankEnv(), ...options };
  const errors: string[] = [];
  let ranked = 0;
  let skippedNoDescription = 0;

  const vacancies = await prisma.vacancy.findMany({
    where: { analyses: { none: {} } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: env.limit,
  });

  logInfo(`ai rank op=query candidates=${vacancies.length} model=${env.model} limit=${env.limit}`);

  for (let i = 0; i < vacancies.length; i++) {
    const vacancy = vacancies[i];
    const input = vacancyToRankInput(vacancy, env.descriptionMaxChars);

    if (!input) {
      skippedNoDescription++;
      logInfo(`ai skip ${vacancyRef(vacancy.provider, vacancy.externalId)} (no description)`);
      continue;
    }

    logInfo(`ai rank ${i + 1}/${vacancies.length} ${vacancyRef(vacancy.provider, vacancy.externalId)}`);

    try {
      const result = await rankVacancyWithDeepSeek(
        env,
        buildRankVacancyMessages(input),
      );
      await saveAnalysis(vacancy, result);
      ranked++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[job-assistant] ai fail ${vacancyRef(vacancy.provider, vacancy.externalId)} error=${msg}`);
      errors.push(`${vacancyRef(vacancy.provider, vacancy.externalId)}: ${msg}`);
    }

    if (env.delayMs > 0) {
      await sleep(env.delayMs);
    }
  }

  logInfo(
    `ai finished ranked=${ranked} errors=${errors.length} skipped_no_description=${skippedNoDescription}`,
  );

  const retention = await cleanupStaleVacanciesIfInline();

  return {
    candidates: vacancies.length,
    ranked,
    skippedNoDescription,
    retention,
    errors,
  };
}
