import type { Vacancy } from "../generated/prisma/client.js";
import type { VacancyRankModelResult } from "../integrations/deepseek/types.js";
import { resolveRankEnv, type RankEnv } from "../config/rank-env.js";
import { rankVacancyWithDeepSeek } from "../integrations/deepseek/client.js";
import { buildRankVacancyMessages } from "../prompts/rank-vacancy.js";
import { prisma } from "../db/client.js";
import { logInfo } from "../utils/log.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

export type RankSyncResult = {
  candidates: number;
  ranked: number;
  skippedNoDescription: number;
  errors: string[];
};

function vacancyToRankInput(v: Vacancy, maxChars: number) {
  const description = v.description?.trim();
  if (!description) {
    return null;
  }

  return {
    hhId: v.hhId,
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
  logInfo(`ai ok hh_id=${vacancy.hhId} score=${result.score}`);
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

  logInfo(`ai rank start candidates=${vacancies.length} model=${env.model}`);

  for (let i = 0; i < vacancies.length; i++) {
    const vacancy = vacancies[i];
    const input = vacancyToRankInput(vacancy, env.descriptionMaxChars);

    if (!input) {
      skippedNoDescription++;
      logInfo(`ai skip hh_id=${vacancy.hhId} (no description)`);
      continue;
    }

    logInfo(`ai rank ${i + 1}/${vacancies.length} hh_id=${vacancy.hhId}`);

    try {
      const result = await rankVacancyWithDeepSeek(
        env,
        buildRankVacancyMessages(input),
      );
      await saveAnalysis(vacancy, result);
      ranked++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[job-assistant] ai fail hh_id=${vacancy.hhId} error=${msg}`);
      errors.push(`hh_id=${vacancy.hhId}: ${msg}`);
    }

    if (env.delayMs > 0) {
      await sleep(env.delayMs);
    }
  }

  logInfo(
    `ai finished ranked=${ranked} errors=${errors.length} skipped_no_description=${skippedNoDescription}`,
  );

  return {
    candidates: vacancies.length,
    ranked,
    skippedNoDescription,
    errors,
  };
}
