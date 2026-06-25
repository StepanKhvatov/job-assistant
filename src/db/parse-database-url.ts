import type { PoolConfig } from "pg";

export type ParsedDatabaseUrl = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: PoolConfig["ssl"];
};

function suggestDatabaseUrlFix(hostname: string): string {
  if (hostname === "base" || hostname === "database" || hostname === "host") {
    return (
      "DATABASE_URL looks like a placeholder (host is \"" +
      hostname +
      "\"). Copy the full URI from Supabase → Connect → Transaction pooler (port 6543, ?pgbouncer=true). " +
      "If the password contains @, #, or :, URL-encode it (@ → %40)."
    );
  }

  if (!hostname.includes(".")) {
    return (
      `DATABASE_URL hostname "${hostname}" is invalid. Use the full Supabase pooler host ` +
      "(e.g. aws-0-….pooler.supabase.com). Encode special characters in the password."
    );
  }

  return `DATABASE_URL hostname "${hostname}" could not be resolved. Check the GitHub secret value.`;
}

/** Parse postgres:// or postgresql:// URL into pg Pool options. */
export function parseDatabaseUrl(connectionString: string): ParsedDatabaseUrl {
  const trimmed = connectionString.trim();
  if (!trimmed) {
    throw new Error("DATABASE_URL is empty");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL. Expected postgresql://user:password@host:port/database",
    );
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`DATABASE_URL must use postgres:// or postgresql://, got ${parsed.protocol}`);
  }

  const host = parsed.hostname;
  if (!host) {
    throw new Error("DATABASE_URL is missing hostname");
  }

  if (host !== "localhost" && !host.includes(".")) {
    throw new Error(suggestDatabaseUrlFix(host));
  }

  const database = parsed.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL is missing database name (path after host)");
  }

  return {
    host,
    port: parsed.port ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    ssl: { rejectUnauthorized: false },
  };
}

export function formatDatabaseUrlForLog(connectionString: string): string {
  try {
    const { host, port, user, database } = parseDatabaseUrl(connectionString);
    return `${user}@${host}:${port}/${database}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}
