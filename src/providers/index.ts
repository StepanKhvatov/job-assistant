/**
 * Реестр джоб-бордов.
 *
 * Карта инструмента:
 *   1. Auth     — cookies в `.auth/` (логин локально, CI только restore)
 *   2. Scrape   — поиск + карточки, адаптер борда
 *   3. Rank     — общий DeepSeek, не знает про HH/LinkedIn
 *   4. Apply    — снова адаптер борда
 *
 * Добавить сервис = файл схемы + объект `JobBoardPlaywrightAdapter`.
 * В БД: `provider` + `externalId`. Не копировать `HH_*` в новый адаптер.
 */

import { HH_BOARD } from "./hh.js";
import { LINKEDIN_BOARD } from "./linkedin.js";
import {
  assertProviderReady,
  type JobBoardId,
  type JobBoardSchema,
} from "./types.js";

export { HH_BOARD, hhLoginUrl, hhSearchUrl, hhSessionProbeUrl, hhVacancyUrl } from "./hh.js";
export {
  LINKEDIN_BOARD,
  linkedinLoginUrl,
  linkedinSearchUrl,
  linkedinSessionProbeUrl,
  linkedinVacancyUrl,
} from "./linkedin.js";
export { assertProviderReady, JOB_BOARD_IDS } from "./types.js";
export type { JobBoardId, JobBoardSchema, ProviderStatus } from "./types.js";

export const JOB_BOARDS = {
  hh: HH_BOARD,
  linkedin: LINKEDIN_BOARD,
} as const satisfies Record<JobBoardId, JobBoardSchema>;

export function getJobBoard(id: JobBoardId): JobBoardSchema {
  return JOB_BOARDS[id];
}

export function requireActiveJobBoard(id: JobBoardId): JobBoardSchema {
  const board = getJobBoard(id);
  assertProviderReady(board);
  return board;
}
