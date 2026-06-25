import "dotenv/config";

import pg from "pg";

import { formatDatabaseUrlForLog, parseDatabaseUrl } from "../src/db/parse-database-url.js";
import { logInfo } from "../src/utils/log.js";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("[job-assistant] DATABASE_URL is not set");
  process.exit(1);
}

let config;
try {
  config = parseDatabaseUrl(connectionString);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[job-assistant] ${msg}`);
  process.exit(1);
}

logInfo(`database check target=${formatDatabaseUrlForLog(connectionString)}`);

const pool = new pg.Pool({
  ...config,
  connectionTimeoutMillis: 15_000,
  max: 1,
});

try {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
  logInfo("database check ok");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[job-assistant] database connection failed: ${msg}`);
  if (msg.includes("EAI_AGAIN") || msg.includes("ENOTFOUND")) {
    console.error(
      "[job-assistant] DNS could not resolve the database host. Re-check DATABASE_URL in GitHub Secrets.",
    );
  }
  process.exit(1);
} finally {
  await pool.end();
}
