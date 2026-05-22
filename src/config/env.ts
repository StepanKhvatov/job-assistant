import { z } from "zod";

import { loadSearchKeyword, normalizeSearchKeyword } from "./load-content.js";

const falseUnless = (v: string | undefined, defaultTrue = true) => {
  if (v === undefined) {
    return defaultTrue;
  }
  return v !== "false";
};

const intInRange = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(raw ?? "", 10);
  const value = Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, value));
};

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  CRON_SECRET: z.string().optional(),

  HH_EMAIL: z.string().optional(),
  HH_PASSWORD: z.string().optional(),
  HH_SEARCH_KEYWORD: z.string(),
  HH_BASE_URL: z.string().url(),

  HEADLESS: z.boolean(),

  MAX_SEARCH_PAGES: z.number().int(),
  MAX_VACANCIES: z.number().int(),
  SCRAPE_DELAY_MS: z.number().int(),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string(),
  RANK_LIMIT: z.number().int(),
  RANK_DELAY_MS: z.number().int(),
  RANK_DESCRIPTION_MAX_CHARS: z.number().int(),

  APPLY_MIN_SCORE: z.number().int(),
  APPLY_MAX_PER_RUN: z.number().int(),
  APPLY_DELAY_MS: z.number().int(),
  APPLY_DRY_RUN: z.boolean(),

  RETENTION_DAYS: z.number().int(),

  HH_VACANCY_ID: z.string().optional(),

  HH_USER_AGENT: z.string().optional(),
  HH_ACCESS_TOKEN: z.string().optional(),
  HH_KEYWORDS: z.string().optional(),
  HH_SEARCH_TEXT: z.string().optional(),
  HH_API_BASE_URL: z.string().url().optional(),
  HH_MAX_PAGES_PER_QUERY: z.number().int().optional(),
  HH_API_DETAIL_DELAY_MS: z.number().int().optional(),
  HH_INCLUDE_OFFICE: z.boolean().optional(),
  HH_INCLUDE_REMOTE: z.boolean().optional(),
  HH_MAX_VACANCIES_DETAIL: z.number().int().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

function resolveSearchKeyword(raw: NodeJS.ProcessEnv): string {
  const explicit =
    raw.HH_SEARCH_KEYWORD?.trim() ||
    raw.HH_SCRAPE_KEYWORD?.trim() ||
    raw.HH_SEARCH_TEXT?.trim();
  if (explicit) {
    return normalizeSearchKeyword(explicit);
  }
  return loadSearchKeyword();
}

function parseRawEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse({
    DATABASE_URL: raw.DATABASE_URL,
    DIRECT_URL: raw.DIRECT_URL,
    NODE_ENV: raw.NODE_ENV,
    PORT: raw.PORT,
    HOST: raw.HOST,
    CRON_SECRET: raw.CRON_SECRET,

    HH_EMAIL: raw.HH_EMAIL?.trim() || undefined,
    HH_PASSWORD: raw.HH_PASSWORD?.trim() || undefined,
    HH_SEARCH_KEYWORD: resolveSearchKeyword(raw),
    HH_BASE_URL: (raw.HH_BASE_URL ?? raw.HH_SCRAPE_BASE_URL ?? "https://novosibirsk.hh.ru").replace(
      /\/$/,
      "",
    ),

    HEADLESS: falseUnless(raw.HEADLESS ?? raw.HH_SCRAPE_HEADLESS, true),

    MAX_SEARCH_PAGES: intInRange(raw.MAX_SEARCH_PAGES ?? raw.HH_SCRAPE_MAX_PAGES, 3, 1, 10),
    MAX_VACANCIES: intInRange(raw.MAX_VACANCIES ?? raw.HH_SCRAPE_MAX_VACANCIES, 50, 1, 500),
    SCRAPE_DELAY_MS: intInRange(
      raw.SCRAPE_DELAY_MS ?? raw.HH_SCRAPE_DETAIL_DELAY_MS,
      800,
      200,
      5000,
    ),

    DEEPSEEK_API_KEY: raw.DEEPSEEK_API_KEY?.trim() || undefined,
    DEEPSEEK_MODEL: raw.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
    RANK_LIMIT: intInRange(raw.RANK_LIMIT ?? raw.AI_RANK_LIMIT, 20, 1, 500),
    RANK_DELAY_MS: intInRange(raw.RANK_DELAY_MS ?? raw.AI_RANK_DELAY_MS, 500, 0, 10_000),
    RANK_DESCRIPTION_MAX_CHARS: intInRange(raw.AI_RANK_DESCRIPTION_MAX_CHARS, 12_000, 500, 30_000),

    APPLY_MIN_SCORE: intInRange(raw.APPLY_MIN_SCORE, 75, 0, 100),
    APPLY_MAX_PER_RUN: intInRange(raw.APPLY_MAX_PER_RUN, 5, 1, 50),
    APPLY_DELAY_MS: intInRange(raw.APPLY_DELAY_MS, 3000, 1000, 60_000),
    APPLY_DRY_RUN: falseUnless(raw.APPLY_DRY_RUN, true),

    RETENTION_DAYS: intInRange(
      raw.RETENTION_DAYS ?? raw.VACANCY_RETENTION_DAYS,
      raw.VACANCY_RETENTION_ENABLED === "false" ? 0 : 45,
      0,
      365,
    ),

    HH_VACANCY_ID: raw.HH_VACANCY_ID?.trim(),

    HH_USER_AGENT: raw.HH_USER_AGENT?.trim() || undefined,
    HH_ACCESS_TOKEN: raw.HH_ACCESS_TOKEN?.trim() || undefined,
    HH_KEYWORDS: raw.HH_KEYWORDS?.trim() || undefined,
    HH_SEARCH_TEXT: raw.HH_SEARCH_TEXT?.trim() || undefined,
    HH_API_BASE_URL: raw.HH_API_BASE_URL?.trim() || raw.HH_API_URL?.trim() || undefined,
    HH_MAX_PAGES_PER_QUERY: intInRange(raw.HH_MAX_PAGES_PER_QUERY, 5, 1, 20),
    HH_API_DETAIL_DELAY_MS: intInRange(raw.HH_DETAIL_DELAY_MS, 350, 0, 5000),
    HH_INCLUDE_OFFICE: falseUnless(raw.HH_INCLUDE_OFFICE, true),
    HH_INCLUDE_REMOTE: falseUnless(raw.HH_INCLUDE_REMOTE, true),
    HH_MAX_VACANCIES_DETAIL: intInRange(raw.HH_MAX_VACANCIES_DETAIL, 200, 1, 500),
  });
}

let cached: AppEnv | null = null;

export function getEnv(reload = false): AppEnv {
  if (reload || !cached) {
    cached = parseRawEnv();
  }
  return cached;
}

export function requireDeepSeekKey(env = getEnv()): string {
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error("Set DEEPSEEK_API_KEY in .env");
  }
  return env.DEEPSEEK_API_KEY;
}

export function requireHhCredentials(env = getEnv()): { email: string; password: string } {
  if (!env.HH_EMAIL || !env.HH_PASSWORD) {
    throw new Error("Set HH_EMAIL and HH_PASSWORD in .env");
  }
  return { email: env.HH_EMAIL, password: env.HH_PASSWORD };
}

/** Fastify @fastify/env (упрощённая схема) */
export const fastifyEnvSchema = {
  type: "object",
  required: ["DATABASE_URL"],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "number", default: 3000 },
    HOST: { type: "string", default: "0.0.0.0" },
    DATABASE_URL: { type: "string" },
    DIRECT_URL: { type: "string" },
    CRON_SECRET: { type: "string" },
    HH_SEARCH_KEYWORD: { type: "string", default: "" },
    HH_KEYWORDS: { type: "string", default: "" },
    HH_USER_AGENT: { type: "string", default: "" },
    HH_ACCESS_TOKEN: { type: "string", default: "" },
  },
} as const;
