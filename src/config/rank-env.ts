import { getEnv, requireDeepSeekKey } from "./env.js";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export type RankEnv = {
  apiKey: string;
  baseUrl: string;
  model: string;
  limit: number;
  delayMs: number;
  descriptionMaxChars: number;
};

export function resolveRankEnv(overrides?: Partial<RankEnv>): RankEnv {
  const e = getEnv();
  return {
    apiKey: requireDeepSeekKey(e),
    baseUrl: DEEPSEEK_BASE_URL,
    model: e.DEEPSEEK_MODEL,
    limit: e.RANK_LIMIT,
    delayMs: e.RANK_DELAY_MS,
    descriptionMaxChars: e.RANK_DESCRIPTION_MAX_CHARS,
    ...overrides,
  };
}
