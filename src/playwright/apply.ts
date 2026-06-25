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
  skippedForeignCountry: "skipped_foreign_country",
  skippedQuestionnaire: "skipped_questionnaire",
  failed: "failed",
} as const;

/** Успешный отклик — повторный не делаем. */
export const APPLICATION_FINAL_STATUSES = [
  APPLICATION_STATUS.applied,
  APPLICATION_STATUS.alreadyApplied,
] as const;

/** Любой статус, после которого вакансию больше не берём в очередь отклика. */
export const APPLICATION_NO_RETRY_STATUSES = [
  ...APPLICATION_FINAL_STATUSES,
  APPLICATION_STATUS.skippedForeignCountry,
  APPLICATION_STATUS.skippedQuestionnaire,
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
  '[data-qa="vacancy-response-popup-form-letter-input"], [data-qa="vacancy-response-letter-input"], textarea[name="letter"], textarea[placeholder*="сопроводительн" i]';

const COVER_LETTER_BLOCK = '[data-qa="cover-letter"], [data-qa="vacancy-response-cover-letter"]';

/** Основная кнопка отправки в модалке отклика. */
const SUBMIT_BTN_POPUP = '[data-qa="vacancy-response-submit-popup"]';
const SUBMIT_BTN_FALLBACK = '[data-qa="vacancy-response-submit"]';

async function isQuestionnaireResponsePage(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("vacancy_response") && url.includes("startedWithQuestion=true")) {
    return true;
  }

  if (!url.includes("vacancy_response")) {
    return false;
  }

  const hasQuestions = await page
    .locator(
      '[data-qa*="employer-question"], [data-qa*="vacancy-question"], [data-qa="task-question"]',
    )
    .first()
    .isVisible()
    .catch(() => false);

  if (hasQuestions) {
    return true;
  }

  return page.getByText(TEST_PAGE_TEXT).first().isVisible().catch(() => false);
}

const SUCCESS_TEXT = /отклик отправлен|резюме доставлено/i;
const TEST_PAGE_TEXT = /тестовое задание|пройдите тест|ответьте на вопросы|анкета/i;
const FOREIGN_COUNTRY_TEXT = /откликаетесь на вакансию в другой стране/i;

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
      await button.click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(200);
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
  | { kind: "test_page" }
  | { kind: "foreign_country" };

async function isForeignCountryPopupVisible(page: Page): Promise<boolean> {
  const dialog = page.getByRole("alertdialog").filter({ hasText: FOREIGN_COUNTRY_TEXT });
  if (await dialog.first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(FOREIGN_COUNTRY_TEXT).first().isVisible().catch(() => false);
}

async function dismissForeignCountryPopup(page: Page, hhId: string): Promise<void> {
  try {
    const dialog = page.getByRole("alertdialog").filter({ hasText: FOREIGN_COUNTRY_TEXT }).first();
    const cancel = dialog
      .getByRole("button", { name: /отменить/i })
      .or(page.getByRole("button", { name: /отменить/i }))
      .first();

    if (await cancel.isVisible().catch(() => false)) {
      logApply(hhId, "foreign_country", "dismiss=Отменить");
      await cancel.click({ timeout: 5_000 }).catch(() => {});
    } else {
      logApply(hhId, "foreign_country", "dismiss=escape");
      await page.keyboard.press("Escape").catch(() => {});
    }

    await dialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(300).catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logApply(hhId, "foreign_country", `dismiss=error ${msg}`);
  }
}

async function waitForApplySurface(page: Page, initialUrl: string, hhId: string): Promise<ApplySurfaceState> {
  const deadline = Date.now() + 45_000;
  let polls = 0;

  while (Date.now() < deadline) {
    polls++;

    if (await page.getByText(SUCCESS_TEXT).first().isVisible().catch(() => false)) {
      logApply(hhId, "surface", "kind=instant_applied");
      return { kind: "instant_applied" };
    }

    if (await isForeignCountryPopupVisible(page)) {
      await dismissForeignCountryPopup(page, hhId);
      logApply(hhId, "surface", "kind=foreign_country");
      return { kind: "foreign_country" };
    }

    const hasForm = await page.locator(RESPONSE_FORM).first().isVisible().catch(() => false);
    const hasLetter = await page.locator(LETTER_FIELD).first().isVisible().catch(() => false);
    const hasResume = await page.locator(RESUME_TRIGGER).first().isVisible().catch(() => false);
    const hasSubmitPopup = await page.locator(SUBMIT_BTN_POPUP).first().isVisible().catch(() => false);
    const hasSubmitFallback = await page.locator(SUBMIT_BTN_FALLBACK).first().isVisible().catch(() => false);
    const hasAddLetter = await page.locator(ADD_COVER_LETTER).first().isVisible().catch(() => false);

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

async function closeResumeDropdown(page: Page, hhId: string): Promise<void> {
  const optionList = page.locator(RESUME_OPTIONS_LIST).first();
  const dropBase = page.locator('[data-qa="drop-base"]').first();
  const dropdownOpen =
    (await optionList.isVisible().catch(() => false)) ||
    (await dropBase.isVisible().catch(() => false));

  if (!dropdownOpen) {
    return;
  }

  const header = page.locator('[data-qa="modal-header"], [data-qa="title-container"]').first();
  if (await header.isVisible().catch(() => false)) {
    logApply(hhId, "resume", "dropdown_close=modal_header_click");
    await header.click({ timeout: 5_000 }).catch(() => {});
  } else {
    logApply(hhId, "resume", "dropdown_close=resume_trigger_toggle");
    await page.locator(RESUME_TRIGGER).first().click({ timeout: 5_000 }).catch(() => {});
  }

  await optionList.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  await dropBase.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(300);
  logApply(hhId, "resume", "dropdown_closed");
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

  const currentTitle = normalizeText((await resumeTrigger.textContent()) ?? "");
  if (currentTitle.includes(normalizedKeyword)) {
    logApply(hhId, "resume", `already_selected title="${currentTitle}"`);
    return;
  }

  logApply(hhId, "resume_open", `keyword="${keyword}" current="${currentTitle}"`);
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
      await closeResumeDropdown(page, hhId);
      logApply(hhId, "resume_selected", `title="${titleText}"`);
      return;
    }
  }

  await closeResumeDropdown(page, hhId);
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

async function resolveApplyModal(page: Page, hhId: string): Promise<Locator> {
  const modal = page
    .locator(
      '[data-qa="vacancy-response-popup"], [data-qa="modal-overlay"], [role="dialog"]',
    )
    .filter({ has: page.locator(`${SUBMIT_BTN_POPUP}, ${SUBMIT_BTN_FALLBACK}`) })
    .first();

  if (await modal.isVisible().catch(() => false)) {
    logApply(hhId, "resolve_modal", "scope=response_popup");
    return modal;
  }

  const scroll = page.locator('[data-qa="modal-content-scroll-container"]').first();
  if (await scroll.isVisible().catch(() => false)) {
    logApply(hhId, "resolve_modal", "scope=modal-content-scroll-container");
    return scroll;
  }

  return resolveApplyRoot(page, hhId);
}

async function logCoverLetterProbe(page: Page, scope: Locator, hhId: string): Promise<void> {
  const pageAdd = await page.locator(ADD_COVER_LETTER).count();
  const scopeAdd = await scope.locator(ADD_COVER_LETTER).count();
  const pageLetter = await page.locator(LETTER_FIELD).count();
  const scopeLetter = await scope.locator(LETTER_FIELD).count();
  const pageWrapper = await page.locator(TEXTAREA_WRAPPER).count();
  logApply(
    hhId,
    "cover_letter_probe",
    `page add=${pageAdd} letter=${pageLetter} wrapper=${pageWrapper} scope add=${scopeAdd} letter=${scopeLetter}`,
  );
}

async function resolveTextareaInWrapper(wrapper: Locator, hhId: string): Promise<Locator | null> {
  const letterInWrapper = wrapper.locator(LETTER_FIELD).first();
  if ((await letterInWrapper.count()) > 0) {
    await letterInWrapper.scrollIntoViewIfNeeded().catch(() => {});
    if (await letterInWrapper.isVisible().catch(() => false)) {
      logApply(hhId, "cover_letter", "field=letter_in_wrapper");
      return letterInWrapper;
    }
  }

  const textarea = wrapper.locator("textarea").first();
  if ((await textarea.count()) === 0) {
    return null;
  }

  const name = (await textarea.getAttribute("name")) ?? "";
  const placeholder = (await textarea.getAttribute("placeholder")) ?? "";
  if (name === "letter" || /сопроводительн/i.test(placeholder)) {
    await textarea.scrollIntoViewIfNeeded().catch(() => {});
    logApply(hhId, "cover_letter", `field=wrapper_textarea name=${name || "—"}`);
    return textarea;
  }

  return null;
}

async function findCoverLetterField(page: Page, hhId: string): Promise<Locator | null> {
  const roots = [
    page.locator(COVER_LETTER_BLOCK).first(),
    page.locator(RESPONSE_FORM).first(),
    page.locator('[data-qa="modal-content-scroll-container"]').first(),
    page,
  ];

  for (const root of roots) {
    if ((await root.count()) === 0) {
      continue;
    }

    const letter = root.locator(LETTER_FIELD).first();
    if ((await letter.count()) > 0 && (await letter.isVisible().catch(() => false))) {
      logApply(hhId, "cover_letter", "field=visible");
      return letter;
    }

    const wrappers = root.locator(TEXTAREA_WRAPPER);
    const wrapperCount = await wrappers.count();
    for (let i = 0; i < wrapperCount; i++) {
      const wrapper = wrappers.nth(i);
      if (!(await wrapper.isVisible().catch(() => false))) {
        continue;
      }

      const resolved = await resolveTextareaInWrapper(wrapper, hhId);
      if (resolved) {
        return resolved;
      }
    }

    const blockLetter = root.locator(`${COVER_LETTER_BLOCK} textarea`).first();
    if ((await blockLetter.count()) > 0 && (await blockLetter.isVisible().catch(() => false))) {
      logApply(hhId, "cover_letter", "field=cover_letter_block");
      return blockLetter;
    }
  }

  const byLabel = page.getByRole("textbox", { name: /сопроводительн/i }).first();
  if ((await byLabel.count()) > 0 && (await byLabel.isVisible().catch(() => false))) {
    logApply(hhId, "cover_letter", "field=label_textbox");
    return byLabel;
  }

  return null;
}

async function ensureCoverLetterField(page: Page, scope: Locator, hhId: string): Promise<Locator> {
  await page.locator(SUBMIT_BTN_POPUP).first().waitFor({ state: "visible", timeout: 15_000 });
  await closeResumeDropdown(page, hhId);
  await logCoverLetterProbe(page, scope, hhId);

  const existing = await findCoverLetterField(page, hhId);
  if (existing) {
    return existing;
  }

  const addButton = page.locator(ADD_COVER_LETTER).first();
  if ((await addButton.count()) === 0 || !(await addButton.isVisible().catch(() => false))) {
    const textLink = page.getByText(/^добавить сопроводительное$/i).first();
    if ((await textLink.count()) > 0 && (await textLink.isVisible().catch(() => false))) {
      logApply(hhId, "cover_letter_add", "click=text_link");
      await textLink.click({ timeout: 10_000 });
    } else if (await isQuestionnaireResponsePage(page)) {
      throw new Error("QUESTIONNAIRE_NO_COVER_LETTER");
    } else {
      throw new Error("Cover letter textarea and add-cover-letter button not found");
    }
  } else {
    logApply(hhId, "cover_letter_add", "click=add-cover-letter");
    await addButton.click({ timeout: 10_000 });
  }

  const afterAdd = await findCoverLetterField(page, hhId);
  if (afterAdd) {
    logApply(hhId, "cover_letter", "field=visible_after_add");
    return afterAdd;
  }

  const textareaFallback = page.locator(`${RESPONSE_FORM} textarea[name="letter"]`).first();
  if (await textareaFallback.isVisible().catch(() => false)) {
    logApply(hhId, "cover_letter", "field=textarea_fallback");
    return textareaFallback;
  }

  if (await isQuestionnaireResponsePage(page)) {
    throw new Error("QUESTIONNAIRE_NO_COVER_LETTER");
  }

  throw new Error("Cover letter textarea not found after add-cover-letter click");
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
    if (await isForeignCountryPopupVisible(page).catch(() => false)) {
      await dismissForeignCountryPopup(page, hhId);
      logApply(hhId, "done", "status=skipped_foreign_country after=error");
      return { status: APPLICATION_STATUS.skippedForeignCountry };
    }
    return { status: APPLICATION_STATUS.failed, error: msg };
  }

  if (surface.kind === "instant_applied") {
    logApply(hhId, "done", "status=applied instant=true");
    return { status: APPLICATION_STATUS.applied };
  }

  if (surface.kind === "test_page") {
    logApply(hhId, "done", "status=skipped_questionnaire reason=test_page");
    return { status: APPLICATION_STATUS.skippedQuestionnaire };
  }

  if (surface.kind === "foreign_country") {
    logApply(hhId, "done", "status=skipped_foreign_country");
    return { status: APPLICATION_STATUS.skippedForeignCountry };
  }

  const modal = await resolveApplyModal(page, hhId);

  await selectResumeByKeyword(page, modal, CANDIDATE_PROFILE.targetRole, hhId);

  let letter: Locator;
  try {
    letter = await ensureCoverLetterField(page, modal, hhId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("QUESTIONNAIRE_NO_COVER_LETTER") || (await isQuestionnaireResponsePage(page))) {
      logApply(hhId, "done", "status=skipped_questionnaire reason=no_cover_letter_field");
      return { status: APPLICATION_STATUS.skippedQuestionnaire };
    }
    logApply(hhId, "error", msg);
    return { status: APPLICATION_STATUS.failed, error: msg };
  }

  await fillReactTextarea(letter, coverLetter, hhId);

  if (dryRun) {
    logApply(hhId, "done", "status=dry_run");
    await page.keyboard.press("Escape").catch(() => {});
    return { status: APPLICATION_STATUS.dryRun };
  }

  try {
    await clickSubmitButton(modal, page, hhId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logApply(hhId, "error", msg);
    return { status: APPLICATION_STATUS.failed, error: msg };
  }

  await page.waitForTimeout(1500);

  if (await isForeignCountryPopupVisible(page)) {
    await dismissForeignCountryPopup(page, hhId);
    logApply(hhId, "done", "status=skipped_foreign_country after=submit");
    return { status: APPLICATION_STATUS.skippedForeignCountry };
  }

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
