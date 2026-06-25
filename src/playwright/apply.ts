import type { Locator, Page } from "playwright";

import { CANDIDATE_PROFILE } from "../config/candidate-profile.js";
import { buildVacancyUrl } from "./config.js";
import { logInfo } from "../utils/log.js";

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

const RESPOND_SELECTORS = [
  '[data-qa="vacancy-response-link-top"]',
  '[data-qa="vacancy-response-link"]',
  'button:has([data-qa="vacancy-response-link-top"])',
  'button:has([data-qa="vacancy-response-link"])',
];

const RESPONSE_FORM = 'form[name="vacancy_response"], #RESPONSE_MODAL_FORM_ID';
const RESUME_TRIGGER = '[data-qa="resume-title"], [data-qa="resume-detail"]';
const RESUME_OPTIONS_LIST = '[data-qa="magritte-select-option-list"]';
const RESUME_OPTION = '[role="option"]';
const RESUME_OPTION_TITLE = '[data-qa="resume-title"] [data-qa="cell-text-content"]';
const ADD_COVER_LETTER = '[data-qa="add-cover-letter"]';
const TEXTAREA_WRAPPER = '[data-qa="textarea-wrapper"]';

const LETTER_FIELD =
  '[data-qa="vacancy-response-popup-form-letter-input"], [data-qa="vacancy-response-letter-input"]';

/** Основная кнопка отправки в модалке отклика. */
const SUBMIT_BTN_POPUP = '[data-qa="vacancy-response-submit-popup"]';
const SUBMIT_BTN_FALLBACK = '[data-qa="vacancy-response-submit"]';

const SUCCESS_TEXT = /отклик отправлен|резюме доставлено/i;
const TEST_PAGE_TEXT = /тестовое задание|пройдите тест|ответьте на вопросы|анкета/i;

function logApply(hhId: string, step: string, detail?: string): void {
  logInfo(detail ? `apply hh_id=${hhId} step=${step} ${detail}` : `apply hh_id=${hhId} step=${step}`);
}

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").trim().toLowerCase();
}

async function dismissBlockingOverlays(page: Page, hhId: string): Promise<void> {
  const labels = ["Понятно", "Согласен", "Accept all", "OK"];
  for (const label of labels) {
    const button = page.getByRole("button", { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      logApply(hhId, "dismiss_overlay", `button="${label}"`);
      await button.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

async function clickRespondButton(page: Page, hhId: string): Promise<void> {
  for (const selector of RESPOND_SELECTORS) {
    const target = page.locator(selector).first();
    if ((await target.count()) === 0) {
      logApply(hhId, "respond_probe", `selector=${selector} found=false`);
      continue;
    }

    await target.scrollIntoViewIfNeeded();
    if (!(await target.isVisible().catch(() => false))) {
      logApply(hhId, "respond_probe", `selector=${selector} visible=false`);
      continue;
    }

    logApply(hhId, "respond_click", `selector=${selector}`);
    await target.click({ timeout: 10_000 });
    return;
  }

  const fallback = page.getByRole("button", { name: /откликнуться/i }).first();
  if ((await fallback.count()) > 0 && (await fallback.isVisible().catch(() => false))) {
    logApply(hhId, "respond_click", "fallback=button[name~=Откликнуться]");
    await fallback.click({ timeout: 10_000 });
    return;
  }

  throw new Error("Response button not found");
}

async function resolveApplyRoot(page: Page, hhId: string): Promise<Locator> {
  const form = page.locator(RESPONSE_FORM).first();
  if (await form.isVisible().catch(() => false)) {
    logApply(hhId, "resolve_root", "scope=form[name=vacancy_response]");
    return form;
  }

  const dialog = page
    .locator('[data-qa="vacancy-response-popup"], [role="dialog"]')
    .filter({
      has: page.locator(
        `${RESPONSE_FORM}, ${TEXTAREA_WRAPPER}, ${RESUME_TRIGGER}, ${SUBMIT_BTN_POPUP}, ${SUBMIT_BTN_FALLBACK}`,
      ),
    })
    .first();

  if (await dialog.isVisible().catch(() => false)) {
    logApply(hhId, "resolve_root", "scope=dialog");
    return dialog;
  }

  logApply(hhId, "resolve_root", "scope=body");
  return page.locator("body");
}

type ApplySurfaceState =
  | { kind: "form" }
  | { kind: "instant_applied" }
  | { kind: "test_page" };

async function waitForApplySurface(page: Page, initialUrl: string, hhId: string): Promise<ApplySurfaceState> {
  const deadline = Date.now() + 45_000;
  let polls = 0;

  while (Date.now() < deadline) {
    polls++;

    if (await page.getByText(SUCCESS_TEXT).first().isVisible().catch(() => false)) {
      logApply(hhId, "surface", "kind=instant_applied");
      return { kind: "instant_applied" };
    }

    const root = await resolveApplyRoot(page, hhId);
    const hasForm = await page.locator(RESPONSE_FORM).first().isVisible().catch(() => false);
    const hasLetter = await root.locator(LETTER_FIELD).first().isVisible().catch(() => false);
    const hasResume = await root.locator(RESUME_TRIGGER).first().isVisible().catch(() => false);
    const hasSubmitPopup = await root.locator(SUBMIT_BTN_POPUP).first().isVisible().catch(() => false);
    const hasSubmitFallback = await root.locator(SUBMIT_BTN_FALLBACK).first().isVisible().catch(() => false);
    const hasAddLetter = await root.locator(ADD_COVER_LETTER).first().isVisible().catch(() => false);

    if (hasForm || hasLetter || hasResume || hasSubmitPopup || hasSubmitFallback || hasAddLetter) {
      logApply(
        hhId,
        "surface_ready",
        `url=${page.url()} form=${hasForm} letter=${hasLetter} resume=${hasResume} submit_popup=${hasSubmitPopup} submit_fallback=${hasSubmitFallback} add_letter=${hasAddLetter} polls=${polls}`,
      );
      return { kind: "form" };
    }

    if (page.url() !== initialUrl) {
      logApply(hhId, "surface_poll", `url_changed=${page.url()} polls=${polls}`);
      await page.waitForLoadState("domcontentloaded").catch(() => {});

      if (page.url().includes("vacancy_response")) {
        if (await page.getByText(TEST_PAGE_TEXT).first().isVisible().catch(() => false)) {
          logApply(hhId, "surface", "kind=test_page");
          return { kind: "test_page" };
        }
      }
    }

    if (polls % 10 === 0) {
      logApply(hhId, "surface_poll", `waiting url=${page.url()} polls=${polls}`);
    }

    await page.waitForTimeout(300);
  }

  throw new Error("Apply form not found after respond click");
}

async function openApplySurface(page: Page, hhId: string): Promise<ApplySurfaceState> {
  await dismissBlockingOverlays(page, hhId);
  const initialUrl = page.url();
  logApply(hhId, "open_modal", `url=${initialUrl}`);
  await clickRespondButton(page, hhId);
  return waitForApplySurface(page, initialUrl, hhId);
}

async function selectResumeByKeyword(
  page: Page,
  root: Locator,
  keyword: string,
  hhId: string,
): Promise<void> {
  const normalizedKeyword = normalizeText(keyword);
  const resumeTrigger = root.locator(RESUME_TRIGGER).first();
  if ((await resumeTrigger.count()) === 0) {
    logApply(hhId, "resume", "skip=no_trigger");
    return;
  }

  logApply(hhId, "resume_open", `keyword="${keyword}"`);
  await resumeTrigger.click();

  const optionList = page.locator(RESUME_OPTIONS_LIST).first();
  await optionList.waitFor({ state: "visible", timeout: 15_000 });

  const options = optionList.locator(RESUME_OPTION);
  const optionCount = await options.count();
  logApply(hhId, "resume_options", `count=${optionCount}`);

  for (let i = 0; i < optionCount; i++) {
    const option = options.nth(i);
    const titleNode = option.locator(RESUME_OPTION_TITLE).first();
    const titleText = normalizeText((await titleNode.textContent()) ?? (await option.textContent()) ?? "");

    if (!titleText) {
      continue;
    }

    logApply(hhId, "resume_option", `index=${i + 1} title="${titleText}"`);

    if (titleText.includes(normalizedKeyword)) {
      await option.click();
      await optionList.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
      logApply(hhId, "resume_selected", `title="${titleText}"`);
      return;
    }
  }

  await page.keyboard.press("Escape").catch(() => {});
  logApply(hhId, "resume", `not_found keyword="${keyword}"`);
}

async function fillReactTextarea(locator: Locator, value: string, hhId: string): Promise<void> {
  try {
    await locator.fill(value);
    logApply(hhId, "cover_letter_fill", `chars=${value.length} method=fill`);
  } catch {
    await locator.evaluate((el, text) => {
      const textarea = el as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) {
        setter.call(textarea, text);
      } else {
        textarea.value = text;
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    logApply(hhId, "cover_letter_fill", `chars=${value.length} method=react_setter`);
  }
}

async function ensureCoverLetterField(root: Locator, hhId: string) {
  const wrapper = root.locator(TEXTAREA_WRAPPER).first();
  if ((await wrapper.count()) === 0 || !(await wrapper.isVisible().catch(() => false))) {
    const addButton = root.locator(ADD_COVER_LETTER).first();
    if ((await addButton.count()) === 0) {
      throw new Error("Cover letter textarea and add-cover-letter button not found");
    }
    logApply(hhId, "cover_letter_add", 'click=data-qa="add-cover-letter"');
    await addButton.click();
    await wrapper.waitFor({ state: "visible", timeout: 15_000 });
  } else {
    logApply(hhId, "cover_letter", 'textarea_wrapper=visible');
  }

  const letter = root.locator(LETTER_FIELD).first();
  await letter.waitFor({ state: "visible", timeout: 15_000 });
  logApply(hhId, "cover_letter", 'field=data-qa="vacancy-response-popup-form-letter-input"');
  return letter;
}

async function clickSubmitButton(root: Locator, page: Page, hhId: string): Promise<void> {
  const popupSubmit = root.locator(SUBMIT_BTN_POPUP).first();
  if ((await popupSubmit.count()) > 0 && (await popupSubmit.isVisible().catch(() => false))) {
    logApply(hhId, "submit_click", 'selector=data-qa="vacancy-response-submit-popup"');
    await popupSubmit.click({ timeout: 15_000 });
    return;
  }

  const fallbackSubmit = root.locator(SUBMIT_BTN_FALLBACK).first();
  if ((await fallbackSubmit.count()) > 0 && (await fallbackSubmit.isVisible().catch(() => false))) {
    logApply(hhId, "submit_click", 'selector=data-qa="vacancy-response-submit" fallback=true');
    await fallbackSubmit.click({ timeout: 15_000 });
    return;
  }

  const pageSubmit = page.locator(SUBMIT_BTN_POPUP).first();
  if ((await pageSubmit.count()) > 0 && (await pageSubmit.isVisible().catch(() => false))) {
    logApply(hhId, "submit_click", 'selector=data-qa="vacancy-response-submit-popup" scope=page');
    await pageSubmit.click({ timeout: 15_000 });
    return;
  }

  throw new Error('Submit button not found (expected data-qa="vacancy-response-submit-popup")');
}

export async function applyToVacancy(
  page: Page,
  baseUrl: string,
  hhId: string,
  coverLetter: string,
  dryRun: boolean,
): Promise<ApplyToVacancyResult> {
  const vacancyUrl = buildVacancyUrl(baseUrl, hhId);
  logApply(hhId, "start", `url=${vacancyUrl} dry_run=${dryRun}`);

  await page.goto(vacancyUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  logApply(hhId, "page_loaded", `url=${page.url()}`);

  await dismissBlockingOverlays(page, hhId);

  const alreadyText = page.getByText(/вы уже откликнулись|отклик отправлен|откликнулись на вакансию/i);
  if ((await alreadyText.count()) > 0) {
    logApply(hhId, "done", "status=already_applied");
    return { status: APPLICATION_STATUS.alreadyApplied };
  }

  let surface: ApplySurfaceState;
  try {
    surface = await openApplySurface(page, hhId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logApply(hhId, "error", msg);
    if (msg.includes("Response button not found")) {
      return { status: APPLICATION_STATUS.noButton };
    }
    return { status: APPLICATION_STATUS.failed, error: msg };
  }

  if (surface.kind === "instant_applied") {
    logApply(hhId, "done", "status=applied instant=true");
    return { status: APPLICATION_STATUS.applied };
  }

  if (surface.kind === "test_page") {
    logApply(hhId, "done", "status=failed reason=test_questionnaire");
    return { status: APPLICATION_STATUS.failed, error: "vacancy requires test/questionnaire" };
  }

  const root = await resolveApplyRoot(page, hhId);

  await selectResumeByKeyword(page, root, CANDIDATE_PROFILE.targetRole, hhId);

  const letter = await ensureCoverLetterField(root, hhId);
  await fillReactTextarea(letter, coverLetter, hhId);

  if (dryRun) {
    logApply(hhId, "done", "status=dry_run");
    await page.keyboard.press("Escape").catch(() => {});
    return { status: APPLICATION_STATUS.dryRun };
  }

  try {
    await clickSubmitButton(root, page, hhId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logApply(hhId, "error", msg);
    return { status: APPLICATION_STATUS.failed, error: msg };
  }

  await page.waitForTimeout(1500);

  if (await page.getByText(SUCCESS_TEXT).first().isVisible().catch(() => false)) {
    logApply(hhId, "done", "status=applied confirmed=success_text");
    return { status: APPLICATION_STATUS.applied };
  }

  const alreadyAppliedText = page.getByText(
    /вы уже откликнулись|отклик отправлен|откликнулись на вакансию/i,
  );
  if ((await alreadyAppliedText.count()) > 0) {
    logApply(hhId, "done", "status=applied confirmed=already_text");
    return { status: APPLICATION_STATUS.applied };
  }

  logApply(hhId, "done", "status=applied confirmed=implicit");
  return { status: APPLICATION_STATUS.applied };
}
