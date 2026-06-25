import type { Page } from "playwright";

import { CANDIDATE_PROFILE } from "../config/candidate-profile.js";
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
const RESPONSE_FORM = 'form[name="vacancy_response"], #RESPONSE_MODAL_FORM_ID';
const RESUME_TRIGGER = '[data-qa="resume-title"], [data-qa="resume-detail"]';
const RESUME_OPTIONS_LIST = '[data-qa="magritte-select-option-list"]';
const RESUME_OPTION = '[role="option"]';
const RESUME_OPTION_TITLE = '[data-qa="resume-title"] [data-qa="cell-text-content"]';
const ADD_COVER_LETTER = '[data-qa="add-cover-letter"]';
const TEXTAREA_WRAPPER = '[data-qa="textarea-wrapper"]';

const LETTER_FIELD =
  '[data-qa="vacancy-response-popup-form-letter-input"], [data-qa="vacancy-response-letter-input"]';

const SUBMIT_BTN =
  '[data-qa="vacancy-response-submit-popup"], [data-qa="vacancy-response-submit"]';

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").trim().toLowerCase();
}

async function openResponseModal(page: Page): Promise<void> {
  const respond = page.locator(RESPOND_LINK).first();
  if ((await respond.count()) === 0) {
    const fallback = page.getByRole("button", { name: /откликнуться/i }).first();
    if ((await fallback.count()) === 0) {
      throw new Error("Response button not found");
    }
    await fallback.click();
  } else {
    await respond.click();
  }
}

async function ensureResponseForm(page: Page) {
  const popup = page.locator(POPUP).first();
  await popup.waitFor({ state: "visible", timeout: 15_000 });

  const form = popup.locator(RESPONSE_FORM).first();
  await form.waitFor({ state: "visible", timeout: 15_000 });

  return { popup, form };
}

async function selectResumeByKeyword(page: Page, popup: ReturnType<Page["locator"]>, keyword: string): Promise<void> {
  const normalizedKeyword = normalizeText(keyword);
  const resumeTrigger = popup.locator(RESUME_TRIGGER).first();
  if ((await resumeTrigger.count()) === 0) {
    return;
  }

  await resumeTrigger.click();

  const optionList = page.locator(RESUME_OPTIONS_LIST).first();
  await optionList.waitFor({ state: "visible", timeout: 15_000 });

  const options = optionList.locator(RESUME_OPTION);
  const optionCount = await options.count();
  for (let i = 0; i < optionCount; i++) {
    const option = options.nth(i);
    const titleNode = option.locator(RESUME_OPTION_TITLE).first();
    const titleText = normalizeText((await titleNode.textContent()) ?? (await option.textContent()) ?? "");

    if (!titleText) {
      continue;
    }

    if (titleText.includes(normalizedKeyword)) {
      await option.click();
      await optionList.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
      return;
    }
  }

  await page.keyboard.press("Escape").catch(() => {});
}

async function ensureCoverLetterField(popup: ReturnType<Page["locator"]>) {
  const wrapper = popup.locator(TEXTAREA_WRAPPER).first();
  if ((await wrapper.count()) === 0) {
    const addButton = popup.locator(ADD_COVER_LETTER).first();
    if ((await addButton.count()) === 0) {
      throw new Error("Cover letter textarea and add-cover-letter button not found");
    }
    await addButton.click();
    await wrapper.waitFor({ state: "visible", timeout: 15_000 });
  } else {
    await wrapper.waitFor({ state: "visible", timeout: 15_000 });
  }

  const letter = popup.locator(LETTER_FIELD).first();
  await letter.waitFor({ state: "visible", timeout: 15_000 });
  return letter;
}

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

  try {
    await openResponseModal(page);
  } catch {
    return { status: APPLICATION_STATUS.noButton };
  }

  const { popup } = await ensureResponseForm(page);

  await selectResumeByKeyword(page, popup, CANDIDATE_PROFILE.targetRole);

  const letter = await ensureCoverLetterField(popup);
  await letter.fill(coverLetter);

  if (dryRun) {
    await page.keyboard.press("Escape").catch(() => {});
    return { status: APPLICATION_STATUS.dryRun };
  }

  const submit = popup.locator(SUBMIT_BTN).first();
  if ((await submit.count()) === 0) {
    return { status: APPLICATION_STATUS.failed, error: "Submit button not found in popup" };
  }

  await submit.click();
  await page.waitForTimeout(1500);

  const alreadyAppliedText = page.getByText(
    /вы уже откликнулись|отклик отправлен|откликнулись на вакансию/i,
  );
  if ((await alreadyAppliedText.count()) > 0) {
    return { status: APPLICATION_STATUS.applied };
  }

  return { status: APPLICATION_STATUS.applied };
}
