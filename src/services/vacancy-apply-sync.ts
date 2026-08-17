/**
 * Отклик по уже проранжированным вакансиям hh.ru.
 *
 * Берёт vacancies с score ≥ порога, без блокирующего applications.status.
 * Письмо: DeepSeek, иначе content/cover-letter.md.
 */
import { chromium } from "playwright";

import { resolveApplyEnv, type ApplyEnv } from "../config/apply-env.js";
import { loadCoverLetter } from "../config/load-content.js";
import { resolveRankEnv } from "../config/rank-env.js";
import { prisma } from "../db/client.js";
import { writeCoverLetterWithDeepSeek } from "../integrations/deepseek/client.js";
import {
  applyToVacancy,
  APPLICATION_NO_RETRY_STATUSES,
  APPLICATION_STATUS,
} from "../playwright/apply.js";
import { assertHhSessionOnPage, formatHhSessionUi } from "../playwright/auth-session.js";
import { assertValidHhAuth, HH_AUTH_PROVIDER } from "../playwright/auth.js";
import { resolveScrapeEnv } from "../playwright/config.js";
import { buildCoverLetterMessages } from "../prompts/cover-letter.js";
import { logInfo, vacancyRef } from "../utils/log.js";
import { sleep } from "../utils/sleep.js";
import { truncate } from "../utils/text.js";
import { cleanupStaleVacanciesIfInline, type RetentionCleanupResult } from "./vacancy-retention.js";

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
  unconfirmed: number;
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

async function buildApplyCoverLetter(
  vacancy: {
    provider: string;
    externalId: string;
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
        provider: vacancy.provider,
        externalId: vacancy.externalId,
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

    logInfo(`apply cover_letter generated ${vacancyRef(vacancy.provider, vacancy.externalId)}`);
    return generated;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logInfo(
      `apply cover_letter fallback ${vacancyRef(vacancy.provider, vacancy.externalId)} reason="${msg}"`,
    );
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
      provider: "hh",
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
    `[${HH_AUTH_PROVIDER}] apply start candidates=${toApply.length} min_score=${applyEnv.minScore} dry_run=${applyEnv.dryRun ? "yes" : "no"}`,
  );

  const errors: string[] = [];
  let applied = 0;
  let dryRunCount = 0;
  let skippedAlready = 0;
  let skippedNoButton = 0;
  let skippedForeignCountry = 0;
  let skippedQuestionnaire = 0;
  let unconfirmed = 0;
  let failed = 0;

  const browser = await chromium.launch({ headless: applyEnv.headless });

  try {
    const context = await browser.newContext({
      storageState: scrapeEnv.authStatePath,
      locale: "ru-RU",
      timezoneId: "Asia/Novosibirsk",
    });
    const page = await context.newPage();

    logInfo(`[${HH_AUTH_PROVIDER}] apply op=verify_session`);
    const session = await assertHhSessionOnPage(page, scrapeEnv.baseUrl);
    logInfo(`[${HH_AUTH_PROVIDER}] apply op=session_ok base=${scrapeEnv.baseUrl} ${formatHhSessionUi(session.ui)}`);

    for (let i = 0; i < toApply.length; i++) {
      const vacancy = toApply[i];
      const score = vacancy.analyses[0]?.score ?? 0;
      let coverLetter = fallbackCoverLetter;
      const ref = vacancyRef(vacancy.provider, vacancy.externalId);
      logInfo(`apply ${i + 1}/${toApply.length} ${ref} score=${score}`);

      try {
        coverLetter = await buildApplyCoverLetter(vacancy, fallbackCoverLetter);
        const result = await applyToVacancy(
          page,
          scrapeEnv.baseUrl,
          vacancy.externalId,
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
            logInfo(`apply ok ${ref}`);
            break;
          case APPLICATION_STATUS.dryRun:
            dryRunCount++;
            logInfo(`apply dry_run ${ref}`);
            break;
          case APPLICATION_STATUS.alreadyApplied:
            skippedAlready++;
            logInfo(`apply skip ${ref} (already applied)`);
            break;
          case APPLICATION_STATUS.noButton:
            skippedNoButton++;
            logInfo(`apply skip ${ref} (no button)`);
            break;
          case APPLICATION_STATUS.skippedForeignCountry:
            skippedForeignCountry++;
            logInfo(`apply skip ${ref} (foreign country)`);
            break;
          case APPLICATION_STATUS.skippedQuestionnaire:
            skippedQuestionnaire++;
            logInfo(`apply skip ${ref} (questionnaire)`);
            break;
          case APPLICATION_STATUS.unconfirmed:
            unconfirmed++;
            logInfo(`apply unconfirmed ${ref}`);
            break;
          default:
            failed++;
            console.error(
              `[job-assistant] apply fail ${ref} error=${result.error ?? result.status}`,
            );
            errors.push(`${ref}: ${result.error ?? result.status}`);
        }

        if (result.sessionDead) {
          logInfo(`apply abort remaining=${toApply.length - i - 1} reason=session_dead`);
          break;
        }
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[job-assistant] apply fail ${ref} error=${msg}`);
        errors.push(`${ref}: ${msg}`);
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

  const retention = await cleanupStaleVacanciesIfInline();

  logInfo(
    `apply finished applied=${applied} dry_run=${dryRunCount} failed=${failed} unconfirmed=${unconfirmed} already=${skippedAlready} no_button=${skippedNoButton} foreign_country=${skippedForeignCountry} questionnaire=${skippedQuestionnaire}`,
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
    unconfirmed,
    failed,
    retention,
    errors,
  };
}
