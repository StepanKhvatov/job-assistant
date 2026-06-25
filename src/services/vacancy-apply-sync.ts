import { chromium } from "playwright";

import { resolveApplyEnv, type ApplyEnv } from "../config/apply-env.js";
import { loadCoverLetter } from "../config/load-content.js";
import { resolveRankEnv } from "../config/rank-env.js";
import { writeCoverLetterWithDeepSeek } from "../integrations/deepseek/client.js";
import { assertHhSessionOnPage } from "../playwright/auth-session.js";
import { assertValidHhAuth, HH_AUTH_PROVIDER } from "../playwright/auth.js";
import { resolveScrapeEnv } from "../playwright/config.js";
import {
  applyToVacancy,
  APPLICATION_NO_RETRY_STATUSES,
  APPLICATION_STATUS,
} from "../playwright/apply.js";
import { buildCoverLetterMessages } from "../prompts/cover-letter.js";
import type { RetentionCleanupResult } from "./vacancy-retention.js";
import { cleanupStaleVacancies } from "./vacancy-retention.js";
import { prisma } from "../db/client.js";
import { logInfo } from "../utils/log.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ApplySyncResult = {
  minScore: number;
  dryRun: boolean;
  candidates: number;
  applied: number;
  dryRunCount: number;
  skippedAlready: number;
  skippedNoButton: number;
  skippedForeignCountry: number;
  skippedQuestionnaire: number;
  failed: number;
  retention: RetentionCleanupResult;
  errors: string[];
};

async function saveApplication(
  vacancyId: string,
  status: string,
  coverLetter: string,
  response: string | null,
) {
  await prisma.application.create({
    data: {
      vacancyId,
      status,
      coverLetter,
      appliedAt: status === APPLICATION_STATUS.applied ? new Date() : null,
      response,
    },
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

async function buildApplyCoverLetter(
  vacancy: {
    hhId: string;
    title: string;
    company: string | null;
    salary: string | null;
    url: string;
    description: string | null;
    analyses: Array<{ summary: string | null }>;
  },
  fallbackCoverLetter: string,
): Promise<string> {
  const description = vacancy.description?.trim();
  if (!description) {
    return fallbackCoverLetter;
  }

  try {
    const rankEnv = resolveRankEnv();
    const generated = await writeCoverLetterWithDeepSeek(
      rankEnv,
      buildCoverLetterMessages({
        hhId: vacancy.hhId,
        title: vacancy.title,
        company: vacancy.company,
        salary: vacancy.salary,
        url: vacancy.url,
        description: truncate(description, rankEnv.descriptionMaxChars),
        analysisSummary: vacancy.analyses[0]?.summary,
      }),
    );

    if (!generated) {
      return fallbackCoverLetter;
    }

    logInfo(`apply cover_letter generated hh_id=${vacancy.hhId}`);
    return generated;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logInfo(`apply cover_letter fallback hh_id=${vacancy.hhId} reason="${msg}"`);
    return fallbackCoverLetter;
  }
}

export async function applyToRankedVacancies(
  options?: Partial<ApplyEnv>,
): Promise<ApplySyncResult> {
  const applyEnv = { ...resolveApplyEnv(), ...options };
  const scrapeEnv = resolveScrapeEnv();
  const fallbackCoverLetter = loadCoverLetter();

  if (!fallbackCoverLetter) {
    throw new Error("content/cover-letter.md is empty");
  }

  assertValidHhAuth(scrapeEnv.authStatePath, scrapeEnv.authMetaPath, scrapeEnv.baseUrl);

  const vacancies = await prisma.vacancy.findMany({
    where: {
      applications: {
        none: { status: { in: [...APPLICATION_NO_RETRY_STATUSES] } },
      },
      analyses: { some: { score: { gte: applyEnv.minScore } } },
    },
    include: {
      analyses: { orderBy: { score: "desc" }, take: 1 },
    },
    take: 200,
  });

  vacancies.sort((a, b) => (b.analyses[0]?.score ?? 0) - (a.analyses[0]?.score ?? 0));
  const toApply = vacancies.slice(0, applyEnv.maxPerRun);

  logInfo(
    `[${HH_AUTH_PROVIDER}] apply start candidates=${toApply.length} min_score=${applyEnv.minScore} dry_run=${applyEnv.dryRun}`,
  );

  const errors: string[] = [];
  let applied = 0;
  let dryRunCount = 0;
  let skippedAlready = 0;
  let skippedNoButton = 0;
  let skippedForeignCountry = 0;
  let skippedQuestionnaire = 0;
  let failed = 0;

  const browser = await chromium.launch({ headless: applyEnv.headless });

  try {
    const context = await browser.newContext({
      storageState: scrapeEnv.authStatePath,
      locale: "ru-RU",
      timezoneId: "Asia/Novosibirsk",
    });
    const page = await context.newPage();

    await assertHhSessionOnPage(page, scrapeEnv.baseUrl);
    logInfo(`[${HH_AUTH_PROVIDER}] session alive base=${scrapeEnv.baseUrl}`);

    for (let i = 0; i < toApply.length; i++) {
      const vacancy = toApply[i];
      const score = vacancy.analyses[0]?.score ?? 0;
      let coverLetter = fallbackCoverLetter;
      logInfo(`apply ${i + 1}/${toApply.length} hh_id=${vacancy.hhId} score=${score}`);

      try {
        coverLetter = await buildApplyCoverLetter(vacancy, fallbackCoverLetter);
        const result = await applyToVacancy(
          page,
          scrapeEnv.baseUrl,
          vacancy.hhId,
          coverLetter,
          applyEnv.dryRun,
        );

        await saveApplication(
          vacancy.id,
          result.status,
          coverLetter,
          result.error ?? null,
        );

        switch (result.status) {
          case APPLICATION_STATUS.applied:
            applied++;
            logInfo(`apply ok hh_id=${vacancy.hhId}`);
            break;
          case APPLICATION_STATUS.dryRun:
            dryRunCount++;
            logInfo(`apply dry_run hh_id=${vacancy.hhId}`);
            break;
          case APPLICATION_STATUS.alreadyApplied:
            skippedAlready++;
            logInfo(`apply skip hh_id=${vacancy.hhId} (already applied)`);
            break;
          case APPLICATION_STATUS.noButton:
            skippedNoButton++;
            logInfo(`apply skip hh_id=${vacancy.hhId} (no button)`);
            break;
          case APPLICATION_STATUS.skippedForeignCountry:
            skippedForeignCountry++;
            logInfo(`apply skip hh_id=${vacancy.hhId} (foreign country)`);
            break;
          case APPLICATION_STATUS.skippedQuestionnaire:
            skippedQuestionnaire++;
            logInfo(`apply skip hh_id=${vacancy.hhId} (questionnaire)`);
            break;
          default:
            failed++;
            console.error(
              `[job-assistant] apply fail hh_id=${vacancy.hhId} error=${result.error ?? result.status}`,
            );
            errors.push(`hh_id=${vacancy.hhId}: ${result.error ?? result.status}`);
        }
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[job-assistant] apply fail hh_id=${vacancy.hhId} error=${msg}`);
        errors.push(`hh_id=${vacancy.hhId}: ${msg}`);
        try {
          await saveApplication(vacancy.id, APPLICATION_STATUS.failed, coverLetter, msg);
        } catch {
          /* duplicate or db error */
        }
      }

      await sleep(applyEnv.delayMs);
    }

    await context.close();
  } finally {
    await browser.close();
  }

  const retention = await cleanupStaleVacancies();

  logInfo(
    `apply finished applied=${applied} dry_run=${dryRunCount} failed=${failed} already=${skippedAlready} no_button=${skippedNoButton} foreign_country=${skippedForeignCountry} questionnaire=${skippedQuestionnaire}`,
  );

  return {
    minScore: applyEnv.minScore,
    dryRun: applyEnv.dryRun,
    candidates: toApply.length,
    applied,
    dryRunCount,
    skippedAlready,
    skippedNoButton,
    skippedForeignCountry,
    skippedQuestionnaire,
    failed,
    retention,
    errors,
  };
}
