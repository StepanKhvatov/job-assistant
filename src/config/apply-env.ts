export type ApplyEnv = {
  minScore: number;
  maxPerRun: number;
  delayMs: number;
  dryRun: boolean;
  headless: boolean;
};

export function resolveApplyEnv(env: NodeJS.ProcessEnv = process.env): ApplyEnv {
  return {
    minScore: Math.min(
      100,
      Math.max(0, Number.parseInt(env.APPLY_MIN_SCORE ?? "75", 10) || 75),
    ),
    maxPerRun: Math.min(
      50,
      Math.max(1, Number.parseInt(env.APPLY_MAX_PER_RUN ?? "5", 10) || 5),
    ),
    delayMs: Math.min(
      60_000,
      Math.max(1000, Number.parseInt(env.APPLY_DELAY_MS ?? "3000", 10) || 3000),
    ),
    dryRun: env.APPLY_DRY_RUN !== "false",
    headless: env.HH_SCRAPE_HEADLESS !== "false",
  };
}
