export const envSchema = {
  type: "object",
  required: ["DATABASE_URL"],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "number", default: 3000 },
    HOST: { type: "string", default: "0.0.0.0" },
    DATABASE_URL: { type: "string" },
    DIRECT_URL: { type: "string" },
    CRON_SECRET: { type: "string" },
  },
} as const;
