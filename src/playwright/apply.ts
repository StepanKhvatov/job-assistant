import type { Page } from "playwright";

import { buildVacancyUrl } from "./config.js";

/** Статусы записи в `applications`. */
export const APPLICATION_STATUS = {
  applied: "applied",
  dryRun: "dry_run",
  alreadyApplied: "already_applied",
  noButton: "no_response_button",
  failed: "failed",
} as const;

/** Финальные статусы — повторный отклик не делаем. */
export const APPLICATION_FINAL_STATUSES = [
  APPLICATION_STATUS.applied,
  APPLICATION_STATUS.alreadyApplied,
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export type ApplyToVacancyResult = {
  status: ApplicationStatus;
  error?: string;
};

const RESPOND_LINK =
  '[data-qa="vacancy-response-link-top"], [data-qa="vacancy-response-link"]';

const POPUP = '[data-qa="vacancy-response-popup"], [role="dialog"]';

const LETTER_FIELD =
  '[data-qa="vacancy-response-popup-form-letter-input"], [data-qa="vacancy-response-letter-input"]';

const SUBMIT_BTN =
  '[data-qa="vacancy-response-submit-popup"], [data-qa="vacancy-response-submit"]';

export async function applyToVacancy(
  page: Page,
  baseUrl: string,
  hhId: string,
  coverLetter: string,
  dryRun: boolean,
): Promise<ApplyToVacancyResult> {
  await page.goto(buildVacancyUrl(baseUrl, hhId), { waitUntil: "domcontentloaded" });

  const alreadyText = page.getByText(/вы уже откликнулись|отклик отправлен|откликнулись на вакансию/i);
  if ((await alreadyText.count()) > 0) {
    return { status: APPLICATION_STATUS.alreadyApplied };
  }

  const respond = page.locator(RESPOND_LINK).first();
  if ((await respond.count()) === 0) {
    const fallback = page.getByRole("button", { name: /откликнуться/i }).first();
    if ((await fallback.count()) === 0) {
      return { status: APPLICATION_STATUS.noButton };
    }
    await fallback.click();
  } else {
    await respond.click();
  }

  const popup = page.locator(POPUP).first();
  await popup.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});

  const letter = popup.locator(LETTER_FIELD).first();
  if ((await letter.count()) > 0) {
    await letter.fill(coverLetter);
  }

  if (dryRun) {
    await page.keyboard.press("Escape").catch(() => {});
    return { status: APPLICATION_STATUS.dryRun };
  }

  const submit = popup.locator(SUBMIT_BTN).first();
  if ((await submit.count()) === 0) {
    return { status: APPLICATION_STATUS.failed, error: "Submit button not found in popup" };
  }

  await submit.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);

  return { status: APPLICATION_STATUS.applied };
}
