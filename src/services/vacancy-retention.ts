import { resolveRetentionEnv, type RetentionEnv } from "../config/retention-env.js";
import { prisma } from "../db/client.js";
import { logInfo } from "../utils/log.js";

export type RetentionCleanupResult = {
  enabled: boolean;
  retentionDays: number;
  cutoff: string | null;
  deletedVacancies: number;
};

/**
 * Удаляет устаревшие вакансии. Связанные analyses/applications — CASCADE.
 *
 * Не удаляем вакансию, если есть любая запись в `applications` (отклик или попытка).
 */
export async function cleanupStaleVacancies(
  options?: Partial<RetentionEnv>,
): Promise<RetentionCleanupResult> {
  const env = { ...resolveRetentionEnv(), ...options };

  if (!env.enabled) {
    logInfo("retention skip (disabled or VACANCY_RETENTION_DAYS=0)");
    return {
      enabled: false,
      retentionDays: env.retentionDays,
      cutoff: null,
      deletedVacancies: 0,
    };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - env.retentionDays);

  const { count } = await prisma.vacancy.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      applications: { none: {} },
    },
  });

  if (count > 0) {
    logInfo(
      `retention deleted=${count} older_than=${env.retentionDays}d cutoff=${cutoff.toISOString().slice(0, 10)}`,
    );
  } else {
    logInfo(`retention deleted=0 older_than=${env.retentionDays}d`);
  }

  return {
    enabled: true,
    retentionDays: env.retentionDays,
    cutoff: cutoff.toISOString(),
    deletedVacancies: count,
  };
}
