import type { Page } from "playwright";

import { HH_AUTH_PROVIDER } from "./auth.js";

export type HhSessionDeadReason = "login_redirect" | "captcha";

export type HhSessionCheckResult =
  | { alive: true; url: string }
  | { alive: false; reason: HhSessionDeadReason; url: string };

function applicantProbeUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/applicant/vacancies`;
}

export async function verifyHhSessionOnPage(
  page: Page,
  baseUrl: string,
): Promise<HhSessionCheckResult> {
  const probeUrl = applicantProbeUrl(baseUrl);
  await page.goto(probeUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  const url = page.url();

  if (url.includes("/account/captcha")) {
    return { alive: false, reason: "captcha", url };
  }

  if (url.includes("/account/login")) {
    return { alive: false, reason: "login_redirect", url };
  }

  return { alive: true, url };
}

export function formatHhSessionExpiredError(result: Extract<HhSessionCheckResult, { alive: false }>): string {
  const reason =
    result.reason === "captcha"
      ? "captcha required (session or IP flagged)"
      : "redirected to login (cookies expired)";

  return [
    `[${HH_AUTH_PROVIDER}] session not alive: ${reason}`,
    `last_url=${result.url}`,
    "Local: HH_SCRAPE_HEADLESS=false npm run playwright:auth",
    "CI: refresh GitHub secret HH_AUTH_STATE_B64 (npm run hh:auth:export)",
  ].join("\n");
}

export async function assertHhSessionOnPage(page: Page, baseUrl: string): Promise<void> {
  const result = await verifyHhSessionOnPage(page, baseUrl);
  if (!result.alive) {
    throw new Error(formatHhSessionExpiredError(result));
  }
}
