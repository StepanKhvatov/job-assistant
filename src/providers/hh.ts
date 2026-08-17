import { HH_AREA_RUSSIA } from "../integrations/hh/constants.js";
import type { JobBoardSchema } from "./types.js";

/**
 * Мастер-схема HeadHunter.
 *
 * Рабочий путь: Playwright-сессия соискателя (cookies), не OAuth.
 * API-токен приложения (`HH_ACCESS_TOKEN`) — запасной сбор вакансий,
 * отклики через него недоступны.
 */

export const HH_SEARCH_ITEMS_PER_PAGE = 50;

export function hhLoginUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/account/login`;
}

/** Главная выбранного хоста hh.ru (не карточка вакансии). */
export function hhHomepageUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/`;
}

/**
 * Ссылка «Войти» в шапке гостя: `<a role="button" data-qa="login">`.
 * Наличие на главной значит, что сессия соискателя не активна.
 * Кнопка «Откликнуться» на карточке вакансии у гостя тоже есть — это не вход.
 */
export const HH_GUEST_LOGIN_LINK_SELECTOR = 'a[role="button"][data-qa="login"]';

export function hhSessionProbeUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/applicant/vacancies`;
}

export function hhSearchUrl(baseUrl: string, keyword: string): string {
  const params = new URLSearchParams();
  params.set("text", keyword.trim());
  params.set("search_field", "name");
  params.set("items_on_page", String(HH_SEARCH_ITEMS_PER_PAGE));
  params.set("area", String(HH_AREA_RUSSIA));
  return `${baseUrl.replace(/\/$/, "")}/search/vacancy?${params.toString()}`;
}

export function hhVacancyUrl(baseUrl: string, vacancyId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/vacancy/${vacancyId}`;
}

export const HH_BOARD = {
  id: "hh",
  status: "active",
  displayName: "HeadHunter",
  sessionMetaProvider: "hh.ru",
  defaultSiteUrl: "https://novosibirsk.hh.ru",
  defaultApiUrl: "https://api.hh.ru",
  capabilities: {
    scrapeSearch: true,
    scrapeDetail: true,
    apply: true,
    officialApiSearch: true,
    officialApiApply: false,
  },
  auth: {
    primary: {
      kind: "playwright-session",
      loginInteractive: true,
      credentialsEnv: ["HH_EMAIL", "HH_PASSWORD"],
      stateFile: ".auth/hh-user.json",
      metaFile: ".auth/hh-session.meta.json",
      ciSecrets: ["HH_AUTH_STATE_B64", "HH_AUTH_META_B64"],
      cookieDomainPattern: /hh\.ru/i,
    },
    secondary: {
      kind: "api-app-token",
      tokenEnv: "HH_ACCESS_TOKEN",
      docsUrl: "https://dev.hh.ru/admin",
      refreshable: false,
    },
  },
  sessionDeadUrlFragments: ["/account/login", "/account/captcha"],
  identity: {
    urlIdPattern: "/vacancy/{id}",
  },
  pipeline: [
    {
      id: "auth",
      title: "Логин соискателя (headed, при капче)",
      command: "npm run playwright:auth",
      shared: false,
    },
    {
      id: "check",
      title: "Проверка, что cookies ещё живые",
      command: "npm run hh:auth:check",
      shared: false,
    },
    {
      id: "scrape",
      title: "Поиск + карточки → vacancies",
      command: "npm run hh:scrape",
      shared: false,
    },
    {
      id: "rank",
      title: "DeepSeek score → analyses",
      command: "npm run ai:rank",
      shared: true,
    },
    {
      id: "apply",
      title: "Отклик с сопроводительным",
      command: "npm run hh:apply",
      shared: false,
    },
    {
      id: "export",
      title: "Экспорт cookies в GitHub Secrets",
      command: "npm run hh:auth:export",
      shared: false,
    },
  ],
  limits: {
    scrapeDelayMs: 800,
    applyDelayMs: 3000,
    notes: [
      "Поиск ограничен area=113 (Россия).",
      "Уже сохранённые (provider, external_id) повторно не парсятся.",
      "APPLY_DRY_RUN=true по умолчанию — кнопка «Отправить» не нажимается.",
    ],
  },
  risks: [
    "Капча и 2FA на логине — только локальный headed-браузер.",
    "Cookies живут недели, не месяцы; CI сам их не обновляет.",
    "Сессия привязана к HH_BASE_URL (novosibirsk.hh.ru ≠ hh.ru).",
    "Кнопка «Откликнуться» на вакансии есть у гостя; вход проверяется по a[role=button][data-qa=login] на главной.",
    "Смена вёрстки ломает селекторы data-qa.",
  ],
} as const satisfies JobBoardSchema;
