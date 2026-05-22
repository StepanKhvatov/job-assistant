import { getEnv } from "./env.js";

export type ApplyEnv = {
  minScore: number;
  maxPerRun: number;
  delayMs: number;
  dryRun: boolean;
  headless: boolean;
};

export function resolveApplyEnv(overrides?: Partial<ApplyEnv>): ApplyEnv {
  const e = getEnv();
  return {
    minScore: e.APPLY_MIN_SCORE,
    maxPerRun: e.APPLY_MAX_PER_RUN,
    delayMs: e.APPLY_DELAY_MS,
    dryRun: e.APPLY_DRY_RUN,
    headless: e.HEADLESS,
    ...overrides,
  };
}
