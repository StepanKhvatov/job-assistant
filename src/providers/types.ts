/**
 * Контракт джоб-борда.
 *
 * Один сервис = один файл схемы (`hh.ts`, `linkedin.ts`). Ранжирование
 * общее и сюда не входит: DeepSeek работает с уже нормализованной вакансией.
 *
 * Поля `status: "planned"` — описание будущего адаптера, без рантайма.
 */

export const JOB_BOARD_IDS = ["hh", "linkedin"] as const;
export type JobBoardId = (typeof JOB_BOARD_IDS)[number];

export type ProviderStatus = "active" | "planned";

export type JobBoardCapabilities = {
  /** Сбор id вакансий из поисковой выдачи в браузере */
  scrapeSearch: boolean;
  /** Парсинг карточки вакансии */
  scrapeDetail: boolean;
  /** Автоотклик через UI */
  apply: boolean;
  /** Официальный поисковый API (без браузера) */
  officialApiSearch: boolean;
  /** Официальный API отклика. У HH закрыт для соискателей. */
  officialApiApply: boolean;
};

export type PlaywrightSessionAuth = {
  kind: "playwright-session";
  /** Логин только локально (капча / 2FA). CI cookies не логинит. */
  loginInteractive: true;
  credentialsEnv: readonly string[];
  stateFile: string;
  metaFile: string;
  ciSecrets: readonly string[];
  cookieDomainPattern: RegExp;
};

export type ApiAppTokenAuth = {
  kind: "api-app-token";
  tokenEnv: string;
  docsUrl: string;
  /** У HH это токен приложения, не OAuth пользователя. Refresh нет. */
  refreshable: false;
};

export type JobBoardAuth = {
  primary: PlaywrightSessionAuth | ApiAppTokenAuth;
  secondary?: PlaywrightSessionAuth | ApiAppTokenAuth;
};

export type PipelineStep = {
  id: string;
  title: string;
  /** npm-скрипт; null — шаг общий или ещё не реализован */
  command: string | null;
  /** Шаг не зависит от конкретного борда (rank, retention) */
  shared: boolean;
};

export type JobBoardSchema = {
  id: JobBoardId;
  status: ProviderStatus;
  displayName: string;
  /**
   * Значение `provider` в `.auth/*.meta.json`.
   * Не менять у активного борда — сломает уже сохранённые сессии.
   */
  sessionMetaProvider: string;
  defaultSiteUrl: string;
  defaultApiUrl?: string;
  capabilities: JobBoardCapabilities;
  auth: JobBoardAuth;
  /** Куски URL, после которых сессия считается мёртвой */
  sessionDeadUrlFragments: readonly string[];
  identity: {
    /** Шаблон URL карточки. В БД id борда — `vacancies.external_id` + `provider`. */
    urlIdPattern: string;
  };
  pipeline: readonly PipelineStep[];
  limits: {
    scrapeDelayMs: number;
    applyDelayMs: number;
    notes: readonly string[];
  };
  risks: readonly string[];
};

export function assertProviderReady(board: JobBoardSchema): void {
  if (board.status !== "active") {
    throw new Error(
      `${board.displayName} (${board.id}) is not implemented yet. See docs/PROVIDERS.md`,
    );
  }
}
