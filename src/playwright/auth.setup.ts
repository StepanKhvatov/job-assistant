import { test as setup, expect } from "@playwright/test";
import "dotenv/config";

import { getEnv, requireHhCredentials } from "../config/env.js";
import {
  formatHhAuthLogMessage,
  getHhLoginUrl,
  HH_AUTH_PROVIDER,
  resolveAuthPaths,
  writeHhAuthMeta,
} from "./auth.js";

const { statePath, metaPath } = resolveAuthPaths();

setup(`authenticate (${HH_AUTH_PROVIDER})`, async ({ page }) => {
  const { email, password } = requireHhCredentials();
  const baseUrl = getEnv().HH_BASE_URL;
  const loginUrl = getHhLoginUrl(baseUrl);

  console.log(formatHhAuthLogMessage("start", baseUrl));

  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Войти" }).click();

  const mailTab = page.getByText("Почта").first();
  await mailTab.click();

  const username = page.getByRole("textbox");

  await username.waitFor({ state: "visible", timeout: 30_000 });
  await username.fill(email);

  const submitUsername = page.getByRole("button", { name: "Войти с паролем" });

  await submitUsername.click();

  const passwordInput = page.getByRole("textbox");

  await passwordInput.waitFor({ state: "visible", timeout: 30_000 });
  await passwordInput.fill(password);

  const submitPassword = page
    .locator('[data-qa="account-login-submit"]')
    .or(page.locator('button[type="submit"]'))
    .first();

  await submitPassword.click();

  await page.waitForURL((url) => !url.pathname.includes("/account/login"), {
    timeout: 60_000,
  });

  await expect(page.locator("body")).toBeVisible();

  await page.context().storageState({ path: statePath });

  writeHhAuthMeta(metaPath, {
    provider: HH_AUTH_PROVIDER,
    baseUrl,
    loginUrl,
    authenticatedAt: new Date().toISOString(),
    accountRole: "applicant",
  });

  console.log(formatHhAuthLogMessage("success", baseUrl));
});
