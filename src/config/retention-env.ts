import { getEnv } from "./env.js";

export type RetentionEnv = {
  enabled: boolean;
  retentionDays: number;
};

export function resolveRetentionEnv(overrides?: Partial<RetentionEnv>): RetentionEnv {
  const e = getEnv();
  return {
    enabled: e.RETENTION_DAYS > 0,
    retentionDays: e.RETENTION_DAYS,
    ...overrides,
  };
}
