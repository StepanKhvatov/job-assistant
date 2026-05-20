import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Идентификатор провайдера авторизации (только hh.ru) */
export const HH_AUTH_PROVIDER = "hh.ru" as const;

export type HhAuthProvider = typeof HH_AUTH_PROVIDER;

export type HhAuthSessionMeta = {
  provider: HhAuthProvider;
  baseUrl: string;
  loginUrl: string;
  authenticatedAt: string;
  /** Роль на hh.ru при логине соискателя */
  accountRole: "applicant";
};

export const DEFAULT_AUTH_STATE_PATH = ".auth/hh-user.json";
export const DEFAULT_AUTH_META_PATH = ".auth/hh-session.meta.json";

export function getHhLoginUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/account/login`;
}

export function resolveAuthPaths(env: NodeJS.ProcessEnv = process.env) {
  const statePath = env.HH_AUTH_STATE_PATH ?? DEFAULT_AUTH_STATE_PATH;
  const metaPath = env.HH_AUTH_META_PATH ?? DEFAULT_AUTH_META_PATH;
  return { statePath, metaPath };
}

export function writeHhAuthMeta(metaPath: string, meta: HhAuthSessionMeta): void {
  mkdirSync(dirname(metaPath), { recursive: true });
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

export function readHhAuthMeta(metaPath: string): HhAuthSessionMeta | null {
  if (!existsSync(metaPath)) {
    return null;
  }
  try {
    const raw = readFileSync(metaPath, "utf8");
    const parsed = JSON.parse(raw) as HhAuthSessionMeta;
    if (parsed.provider !== HH_AUTH_PROVIDER) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Проверяет, что сессия сохранена именно для hh.ru (не пустой файл от другого сервиса). */
export function assertValidHhAuth(
  statePath: string,
  metaPath: string,
  expectedBaseUrl?: string,
): void {
  if (!existsSync(statePath)) {
    throw new Error(`HH auth state missing at ${statePath}. Run: npm run playwright:auth`);
  }

  const meta = readHhAuthMeta(metaPath);
  if (!meta) {
    throw new Error(
      `HH auth metadata missing or invalid at ${metaPath}. Re-run: npm run playwright:auth`,
    );
  }

  if (meta.provider !== HH_AUTH_PROVIDER) {
    throw new Error(`Expected auth provider ${HH_AUTH_PROVIDER}, got ${meta.provider}`);
  }

  if (expectedBaseUrl && meta.baseUrl.replace(/\/$/, "") !== expectedBaseUrl.replace(/\/$/, "")) {
    throw new Error(
      `HH session was created for ${meta.baseUrl}, but scrape uses ${expectedBaseUrl}. Re-run: npm run playwright:auth`,
    );
  }
}

export function formatHhAuthLogMessage(phase: "start" | "success", baseUrl: string): string {
  const prefix = `[job-assistant][${HH_AUTH_PROVIDER}]`;
  if (phase === "start") {
    return `${prefix} Authenticating on ${baseUrl}…`;
  }
  return `${prefix} Session saved for ${baseUrl}`;
}
