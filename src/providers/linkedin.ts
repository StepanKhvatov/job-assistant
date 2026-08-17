import type { JobBoardSchema } from "./types.js";

/**
 * Мастер-схема LinkedIn (planned).
 *
 * Рантайма нет: это контракт, чтобы HH и LinkedIn жили по одной карте
 * (auth → scrape → rank → apply), а не копировали hh-специфичные имена.
 *
 * LinkedIn Jobs нельзя включить «как HH»: Easy Apply ≠ внешний ATS,
 * антибот сильнее, официальный API почти закрыт.
 */

export function linkedinLoginUrl(baseUrl = "https://www.linkedin.com"): string {
  return `${baseUrl.replace(/\/$/, "")}/login`;
}

export function linkedinSessionProbeUrl(baseUrl = "https://www.linkedin.com"): string {
  return `${baseUrl.replace(/\/$/, "")}/feed/`;
}

export function linkedinSearchUrl(
  baseUrl: string,
  keyword: string,
  geoId?: string,
): string {
  const params = new URLSearchParams();
  params.set("keywords", keyword.trim());
  if (geoId) {
    params.set("geoId", geoId);
  }
  params.set("f_TPR", "r86400");
  return `${baseUrl.replace(/\/$/, "")}/jobs/search/?${params.toString()}`;
}

export function linkedinVacancyUrl(baseUrl: string, jobId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/jobs/view/${jobId}`;
}

export const LINKEDIN_BOARD = {
  id: "linkedin",
  status: "planned",
  displayName: "LinkedIn Jobs",
  sessionMetaProvider: "linkedin.com",
  defaultSiteUrl: "https://www.linkedin.com",
  capabilities: {
    scrapeSearch: false,
    scrapeDetail: false,
    apply: false,
    officialApiSearch: false,
    officialApiApply: false,
  },
  auth: {
    primary: {
      kind: "playwright-session",
      loginInteractive: true,
      credentialsEnv: ["LINKEDIN_EMAIL", "LINKEDIN_PASSWORD"],
      stateFile: ".auth/linkedin-user.json",
      metaFile: ".auth/linkedin-session.meta.json",
      ciSecrets: ["LINKEDIN_AUTH_STATE_B64", "LINKEDIN_AUTH_META_B64"],
      cookieDomainPattern: /linkedin\.com/i,
    },
  },
  sessionDeadUrlFragments: ["/login", "/checkpoint/", "/challenge/"],
  identity: {
    urlIdPattern: "/jobs/view/{id}",
  },
  pipeline: [
    {
      id: "auth",
      title: "Логин (headed; checkpoint / 2FA почти всегда)",
      command: null,
      shared: false,
    },
    {
      id: "check",
      title: "Проба /feed/ без редиректа на login",
      command: null,
      shared: false,
    },
    {
      id: "scrape",
      title: "Jobs search → карточки",
      command: null,
      shared: false,
    },
    {
      id: "rank",
      title: "Тот же DeepSeek, что и для HH",
      command: "npm run ai:rank",
      shared: true,
    },
    {
      id: "apply",
      title: "Только Easy Apply; внешний ATS — skip",
      command: null,
      shared: false,
    },
  ],
  limits: {
    scrapeDelayMs: 2500,
    applyDelayMs: 8000,
    notes: [
      "Cookie `li_at` — основной сессионный токен; slim-export только linkedin.com.",
      "Easy Apply и «Apply on company site» — разные ветки; вторую автоматизировать не стоит.",
      "В БД вакансия — unique (provider, external_id); LinkedIn пишется с provider=linkedin.",
      "Официальный Jobs API — партнёрская программа, для личного бота недоступен.",
    ],
  },
  risks: [
    "Checkpoint / captcha / phone verify чаще, чем на hh.ru.",
    "ToS LinkedIn запрещает scraping; только личное использование, низкая частота.",
    "CI с датацентра GitHub с высокой вероятностью получит challenge.",
    "Селекторы без стабильного data-qa — ломкие.",
  ],
} as const satisfies JobBoardSchema;
