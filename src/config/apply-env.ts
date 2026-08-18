import { getEnv } from "./env.js";
import { getJobBoard, type JobBoardId } from "../providers/index.js";

export type ApplyEnv = {
  minScore: number;
  maxPerRun: number;
  delayMs: number;
  headless: boolean;
};

export function resolveApplyEnv(
  boardId: JobBoardId = "hh",
  overrides?: Partial<ApplyEnv>,
): ApplyEnv {
  const e = getEnv();
  const board = getJobBoard(boardId);
  return {
    minScore: e.APPLY_MIN_SCORE,
    maxPerRun: e.APPLY_MAX_PER_RUN,
    delayMs: e.APPLY_DELAY_MS ?? board.limits.applyDelayMs,
    headless: e.HEADLESS,
    ...overrides,
  };
}
