import type { Page } from "playwright";

import {
  HH_BOARD,
  HH_GUEST_LOGIN_LINK_SELECTOR,
  hhHomepageUrl,
  hhSessionProbeUrl,
} from "../providers/hh.js";
import { logInfo } from "../utils/log.js";
import { HH_AUTH_PROVIDER } from "./auth.js";

export type HhSessionDeadReason =
  | "login_redirect"
  | "captcha"
  | "login_link"
  | "login_button"
  | "login_form";

export type HhSessionUiSignals = {
  /** `<a role="button" data-qa="login">` в DOM (гость). */
  loginLink: boolean;
  loginLinkVisible: boolean;
  loginButton: boolean;
  loginForm: boolean;
  applicantLink: boolean;
};

export type HhSessionCheckResult =
  | { alive: true; url: string; ui: HhSessionUiSignals }
  | { alive: false; reason: HhSessionDeadReason; url: string; ui: HhSessionUiSignals };

function yn(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

function logSession(op: string, detail?: string): void {
  logInfo(detail ? `[${HH_AUTH_PROVIDER}] session check op=${op} ${detail}` : `[${HH_AUTH_PROVIDER}] session check op=${op}`);
}

/** Кнопка «Войти» в шапке — гость, даже если URL ещё не /account/login. */
export function hhHeaderLoginButton(page: Page) {
  return page.getByRole("button", { name: /^(войти|sign in)$/i }).first();
}

export function hhGuestLoginLink(page: Page) {
  return page.locator(HH_GUEST_LOGIN_LINK_SELECTOR);
}

export function hhLoginForm(page: Page) {
  return page
    .locator('[data-qa="account-login-submit"]')
    .or(page.getByRole("button", { name: /войти с/i }))
    .first();
}

export async function readHhSessionUi(page: Page): Promise<HhSessionUiSignals> {
  const loginLinkLoc = hhGuestLoginLink(page);
  const loginLinkCount = await loginLinkLoc.count();
  const loginLink = loginLinkCount > 0;
  const loginLinkVisible = loginLink ? await loginLinkLoc.first().isVisible().catch(() => false) : false;
  const loginButton = await hhHeaderLoginButton(page).isVisible().catch(() => false);
  const loginForm = await hhLoginForm(page).isVisible().catch(() => false);
  const applicantLink = await page.locator('a[href*="/applicant/"]').first().isVisible().catch(() => false);

  return { loginLink, loginLinkVisible, loginButton, loginForm, applicantLink };
}

export function formatHhSessionUi(ui: HhSessionUiSignals): string {
  return [
    `login_link=${yn(ui.loginLink)}`,
    `login_link_visible=${yn(ui.loginLinkVisible)}`,
    `login_button=${yn(ui.loginButton)}`,
    `login_form=${yn(ui.loginForm)}`,
    `applicant_link=${yn(ui.applicantLink)}`,
  ].join(" ");
}

async function deadIfGuestSignals(
  page: Page,
  ui: HhSessionUiSignals,
): Promise<Extract<HhSessionCheckResult, { alive: false }> | null> {
  const url = page.url();

  if (url.includes("/account/captcha")) {
    return { alive: false, reason: "captcha", url, ui };
  }

  if (HH_BOARD.sessionDeadUrlFragments.some((fragment) => url.includes(fragment))) {
    return { alive: false, reason: "login_redirect", url, ui };
  }

  if (ui.loginForm) {
    return { alive: false, reason: "login_form", url, ui };
  }

  if (ui.loginLink) {
    return { alive: false, reason: "login_link", url, ui };
  }

  if (ui.loginButton) {
    return { alive: false, reason: "login_button", url, ui };
  }

  return null;
}

export async function verifyHhSessionOnPage(
  page: Page,
  baseUrl: string,
): Promise<HhSessionCheckResult> {
  const homeUrl = hhHomepageUrl(baseUrl);
  const probeUrl = hhSessionProbeUrl(baseUrl);

  logSession("start", `base=${baseUrl}`);
  logSession(
    "note",
    "vacancy «Откликнуться» is also shown to guests; session is proven by absence of homepage login link",
  );

  logSession("goto_home", `url=${homeUrl}`);
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  logSession("home_loaded", `url=${page.url()}`);

  const homeUi = await readHhSessionUi(page);
  logSession(
    "probe_login_link",
    `selector=${HH_GUEST_LOGIN_LINK_SELECTOR} ${formatHhSessionUi(homeUi)}`,
  );

  const homeDead = await deadIfGuestSignals(page, homeUi);
  if (homeDead) {
    logSession("result", `alive=no reason=${homeDead.reason} url=${homeDead.url} ${formatHhSessionUi(homeDead.ui)}`);
    return homeDead;
  }

  logSession("goto_applicant", `url=${probeUrl}`);
  await page.goto(probeUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  logSession("applicant_loaded", `url=${page.url()}`);

  const applicantUi = await readHhSessionUi(page);
  logSession("probe_applicant", formatHhSessionUi(applicantUi));

  const applicantDead = await deadIfGuestSignals(page, applicantUi);
  if (applicantDead) {
    logSession(
      "result",
      `alive=no reason=${applicantDead.reason} url=${applicantDead.url} ${formatHhSessionUi(applicantDead.ui)}`,
    );
    return applicantDead;
  }

  logSession("result", `alive=yes url=${page.url()} ${formatHhSessionUi(applicantUi)}`);
  return { alive: true, url: page.url(), ui: applicantUi };
}

export function formatHhSessionExpiredError(result: Extract<HhSessionCheckResult, { alive: false }>): string {
  const reason =
    result.reason === "captcha"
      ? "captcha required (session or IP flagged)"
      : result.reason === "login_link"
        ? `homepage has ${HH_GUEST_LOGIN_LINK_SELECTOR} — guest, not logged in (vacancy «Откликнуться» is not proof of session)`
        : result.reason === "login_button"
          ? "header still shows Войти (guest UI, cookies not enough for applicant)"
          : result.reason === "login_form"
            ? "login form is visible"
            : "redirected to login (cookies expired)";

  return [
    `[${HH_AUTH_PROVIDER}] session not alive: ${reason}`,
    `last_url=${result.url} ${formatHhSessionUi(result.ui)}`,
    "Local: HEADLESS=false npm run playwright:auth",
    "CI: refresh GitHub secret HH_AUTH_STATE_B64 — see docs/AUTH.md",
  ].join("\n");
}

export async function assertHhSessionOnPage(
  page: Page,
  baseUrl: string,
): Promise<Extract<HhSessionCheckResult, { alive: true }>> {
  const result = await verifyHhSessionOnPage(page, baseUrl);
  if (!result.alive) {
    throw new Error(formatHhSessionExpiredError(result));
  }
  return result;
}
