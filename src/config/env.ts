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

const optionalIntInRange = (raw: string | undefined, min: number, max: number) => {
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return Math.min(max, Math.max(min, n));
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
  SCRAPE_DELAY_MS: z.number().int().optional(),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string(),
  RANK_LIMIT: z.number().int(),
  RANK_DELAY_MS: z.number().int(),
  RANK_DESCRIPTION_MAX_CHARS: z.number().int(),

  APPLY_MIN_SCORE: z.number().int(),
  APPLY_MAX_PER_RUN: z.number().int(),
  APPLY_DELAY_MS: z.number().int().optional(),

  RETENTION_DAYS: z.number().int(),
  RETENTION_INLINE: z.boolean(),

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
  const explicit = raw.HH_SEARCH_KEYWORD?.trim();
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
    HH_BASE_URL: (raw.HH_BASE_URL ?? "https://novosibirsk.hh.ru").replace(/\/$/, ""),

    HEADLESS: falseUnless(raw.HEADLESS, true),
    SCRAPE_DELAY_MS: optionalIntInRange(raw.SCRAPE_DELAY_MS, 200, 15_000),

    DEEPSEEK_API_KEY: raw.DEEPSEEK_API_KEY?.trim() || undefined,
    DEEPSEEK_MODEL: raw.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
    RANK_LIMIT: intInRange(raw.RANK_LIMIT, 100, 1, 500),
    RANK_DELAY_MS: intInRange(raw.RANK_DELAY_MS, 500, 0, 10_000),
    RANK_DESCRIPTION_MAX_CHARS: intInRange(raw.RANK_DESCRIPTION_MAX_CHARS, 12_000, 500, 30_000),

    APPLY_MIN_SCORE: intInRange(raw.APPLY_MIN_SCORE, 60, 0, 100),
    APPLY_MAX_PER_RUN: intInRange(raw.APPLY_MAX_PER_RUN, 30, 1, 50),
    APPLY_DELAY_MS: optionalIntInRange(raw.APPLY_DELAY_MS, 1000, 60_000),

    RETENTION_DAYS: intInRange(raw.RETENTION_DAYS, 45, 0, 365),
    RETENTION_INLINE: falseUnless(raw.RETENTION_INLINE, true),

    HH_VACANCY_ID: raw.HH_VACANCY_ID?.trim(),

    HH_USER_AGENT: raw.HH_USER_AGENT?.trim() || undefined,
    HH_ACCESS_TOKEN: raw.HH_ACCESS_TOKEN?.trim() || undefined,
    HH_KEYWORDS: raw.HH_KEYWORDS?.trim() || undefined,
    HH_SEARCH_TEXT: raw.HH_SEARCH_TEXT?.trim() || undefined,
    HH_API_BASE_URL: raw.HH_API_BASE_URL?.trim() || undefined,
    HH_MAX_PAGES_PER_QUERY: intInRange(raw.HH_MAX_PAGES_PER_QUERY, 5, 1, 20),
    HH_API_DETAIL_DELAY_MS: intInRange(raw.HH_API_DETAIL_DELAY_MS, 350, 0, 5000),
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

/** Fastify @fastify/env — только HTTP (health + запасной hh:sync). */
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
    HH_SEARCH_TEXT: { type: "string", default: "" },
    HH_KEYWORDS: { type: "string", default: "" },
    HH_USER_AGENT: { type: "string", default: "" },
    HH_ACCESS_TOKEN: { type: "string", default: "" },
    HH_API_BASE_URL: { type: "string", default: "" },
    HH_MAX_PAGES_PER_QUERY: { type: "string", default: "" },
    HH_API_DETAIL_DELAY_MS: { type: "string", default: "" },
    HH_INCLUDE_OFFICE: { type: "string", default: "" },
    HH_INCLUDE_REMOTE: { type: "string", default: "" },
    HH_MAX_VACANCIES_DETAIL: { type: "string", default: "" },
  },
} as const;
