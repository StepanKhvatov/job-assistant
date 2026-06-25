import "dotenv/config";

import { chromium } from "playwright";

import { resolveScrapeEnv, buildVacancyUrl } from "../src/playwright/config.js";
import { assertValidHhAuth } from "../src/playwright/auth.js";

const hhId = process.argv[2] ?? "133795908";
const env = resolveScrapeEnv();
assertValidHhAuth(env.authStatePath, env.authMetaPath, env.baseUrl);

const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: env.authStatePath })).newPage();

await page.goto(buildVacancyUrl(env.baseUrl, hhId));
for (const label of ["Понятно", "OK"]) {
  const b = page.getByRole("button", { name: label }).first();
  if (await b.isVisible().catch(() => false)) await b.click({ timeout: 2000 }).catch(() => {});
}

await page.locator('[data-qa="vacancy-response-link-top"]').first().click();
await page.waitForTimeout(1500);

const add = page.locator('[data-qa="add-cover-letter"]').first();
console.log("add visible", await add.isVisible());
await add.click({ force: true });
await page.waitForTimeout(2000);

const qa = await page.evaluate(() =>
  [...document.querySelectorAll("[data-qa]")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const q = el.getAttribute("data-qa") ?? "";
      return r.width > 0 && r.height > 0 && /letter|textarea|cover/i.test(q);
    })
    .map((el) => el.getAttribute("data-qa")),
);
console.log("letter-related qa:", qa);

const textareas = await page.locator("textarea").all();
for (let i = 0; i < textareas.length; i++) {
  const t = textareas[i];
  console.log(
    i,
    await t.isVisible(),
    await t.getAttribute("data-qa"),
    await t.getAttribute("name"),
    (await t.getAttribute("placeholder"))?.slice(0, 40),
  );
}

await page.screenshot({ path: `.auth/debug/after-add-letter-${hhId}.png` });
await browser.close();
