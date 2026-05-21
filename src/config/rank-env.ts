export type RankEnv = {
  apiKey: string;
  baseUrl: string;
  model: string;
  limit: number;
  delayMs: number;
  descriptionMaxChars: number;
};

export function resolveRankEnv(env: NodeJS.ProcessEnv = process.env): RankEnv {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set DEEPSEEK_API_KEY in .env (https://platform.deepseek.com/api_keys)");
  }

  return {
    apiKey,
    baseUrl: (env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
    limit: Math.min(
      500,
      Math.max(1, Number.parseInt(env.AI_RANK_LIMIT ?? "20", 10) || 20),
    ),
    delayMs: Math.min(
      10_000,
      Math.max(0, Number.parseInt(env.AI_RANK_DELAY_MS ?? "500", 10) || 500),
    ),
    descriptionMaxChars: Math.min(
      30_000,
      Math.max(500, Number.parseInt(env.AI_RANK_DESCRIPTION_MAX_CHARS ?? "12000", 10) || 12000),
    ),
  };
}
