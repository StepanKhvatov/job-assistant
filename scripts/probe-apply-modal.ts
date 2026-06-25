import "dotenv/config";

import { chromium } from "playwright";

import { loadCoverLetter } from "../src/config/load-content.js";
import { CANDIDATE_PROFILE } from "../src/config/candidate-profile.js";
import { resolveScrapeEnv } from "../src/playwright/config.js";
import { buildVacancyUrl } from "../src/playwright/config.js";
import { assertValidHhAuth } from "../src/playwright/auth.js";
import { prisma } from "../src/db/client.js";

const hhId = process.argv[2] ?? process.env.HH_VACANCY_ID;
if (!hhId) {
  console.error("Usage: tsx scripts/probe-apply-modal.ts <hh_id>");
  process.exit(1);
}

const env = resolveScrapeEnv();
assertValidHhAuth(env.authStatePath, env.authMetaPath, env.baseUrl);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: env.authStatePath,
  locale: "ru-RU",
});
const page = await context.newPage();

await page.goto(buildVacancyUrl(env.baseUrl, hhId), { waitUntil: "domcontentloaded" });

for (const label of ["Понятно", "OK"]) {
  const b = page.getByRole("button", { name: label }).first();
  if (await b.isVisible().catch(() => false)) await b.click();
}

await page.locator('[data-qa="vacancy-response-link-top"]').first().click({ timeout: 15_000 });
await page.waitForTimeout(2000);

const foreign = page.getByRole("alertdialog").filter({ hasText: /другой стране/i });
if (await foreign.isVisible().catch(() => false)) {
  console.log("FOREIGN COUNTRY DIALOG - click Отменить");
  await foreign.getByRole("button", { name: /отменить/i }).click();
  await browser.close();
  await prisma.$disconnect();
  process.exit(2);
}

const qa = await page.evaluate(() =>
  [...document.querySelectorAll("[data-qa]")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .map((el) => el.getAttribute("data-qa"))
    .filter(Boolean),
);

console.log("visible data-qa:", [...new Set(qa)].sort().join("\n  "));

const textareas = await page.locator("textarea").all();
console.log("textarea count:", textareas.length);
for (let i = 0; i < textareas.length; i++) {
  const t = textareas[i];
  const visible = await t.isVisible().catch(() => false);
  const qaAttr = await t.getAttribute("data-qa");
  const name = await t.getAttribute("name");
  console.log(`textarea[${i}] visible=${visible} data-qa=${qaAttr} name=${name}`);
}

await page.screenshot({ path: `.auth/debug/apply-modal-${hhId}.png`, fullPage: true });
console.log("screenshot saved");

await browser.close();
await prisma.$disconnect();
