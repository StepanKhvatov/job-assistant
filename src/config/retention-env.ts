export type RetentionEnv = {
  enabled: boolean;
  /** Сколько дней хранить вакансию с момента created_at. 0 = очистка выключена. */
  retentionDays: number;
};

export function resolveRetentionEnv(env: NodeJS.ProcessEnv = process.env): RetentionEnv {
  const retentionDays = Math.max(
    0,
    Number.parseInt(env.VACANCY_RETENTION_DAYS ?? "45", 10) || 45,
  );

  const enabled =
    env.VACANCY_RETENTION_ENABLED !== "false" && retentionDays > 0;

  return { enabled, retentionDays };
}
