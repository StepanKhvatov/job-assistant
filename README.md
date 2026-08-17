# job-assistant

Personal AI-assisted job search: scrape → AI ranking → auto-apply.

**Сейчас работает HeadHunter.** LinkedIn — схема без рантайма (`src/providers/linkedin.ts`).

Карта сервисов: [docs/PROVIDERS.md](docs/PROVIDERS.md).  
Как обновлять cookies/токены: [docs/AUTH.md](docs/AUTH.md).

**Stack:** Node.js, TypeScript, Fastify (health/API sync), Prisma, Supabase (Postgres), GitHub Actions, DeepSeek.

## Prerequisites

- Node.js 20+
- Supabase project with Postgres

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Fill connection strings from Supabase → **Connect**:
   - `DATABASE_URL` — **Transaction mode**, port **6543**, add `?pgbouncer=true`
   - `DIRECT_URL` — **Session mode**, port **5432** (same pooler host, not `db.*.supabase.co`)

3. Install and generate Prisma client:

```bash
npm install
npm run db:generate
npm run db:migrate:deploy
```

> Prisma 7: migrations must use session pooler (`DIRECT_URL`).  
> `npm run db:migrate` / `db:migrate:deploy` do this automatically.

4. Configure **HeadHunter** (публичный API, без OAuth):
   - `HH_USER_AGENT` — обязателен для hh.ru, укажите контакт, например:  
     `job-assistant/1.0 (+https://github.com/ВАШ_ЛОГИН/job-assistant)`
   - `HH_KEYWORDS` — ключевые слова **через запятую** (в поиске объединяются через **OR**), например:  
     `Frontend,React,TypeScript`
   - или задайте целиком строку поиска: `HH_SEARCH_TEXT` (имеет приоритет над ключевыми словами)

   Поиск по умолчанию:
   - **Офлайн / Новосибирск** — `area=4` (город), без фильтра `schedule=remote`
   - **Удалёнка / Россия** — `area=113`, `schedule=remote`

   Отключить один из режимов: `HH_INCLUDE_OFFICE=false` или `HH_INCLUDE_REMOTE=false`.

   Лимит запросов «полного описания» за один sync: `HH_MAX_VACANCIES_DETAIL` (по умолчанию 200; только для `hh:sync`, список сначала сортируется по дате публикации, новые — в приоритете).

   Если `HH_KEYWORDS` и `HH_SEARCH_TEXT` не заданы, используется профиль по умолчанию из `src/config/candidate-profile.ts` (роль и короткий набор ключевых слов для hh.ru).

5. Start the API:

```bash
npm run dev
```

6. Check health:

- http://localhost:3000/health
- http://localhost:3000/health/db

## HH.ru — сбор вакансий (рекомендуется: Playwright)

Соискательский API закрыт. Основной путь — **скрапинг** под вашим аккаунтом.

1. В `.env`: `DATABASE_URL`, `HH_EMAIL`, `HH_PASSWORD`, `DEEPSEEK_API_KEY` — поисковая фраза в `content/candidate-profile.md` (секция «Поиск на hh.ru»)

2. Полный цикл без повторного логина (сессия в `.auth/`):

```bash
npm run hh:run
```

Первый раз или после истечения сессии — логин вручную (капча в headed-режиме):

```bash
HH_SCRAPE_HEADLESS=false npm run playwright:auth
```

Проверка и обновление cookies: [docs/AUTH.md](docs/AUTH.md).

```bash
npm run hh:auth:check
```

Экспорт сессии для GitHub Actions:

```bash
npm run hh:auth:export
```

Сохраните вывод в secrets `HH_AUTH_STATE_B64` и `HH_AUTH_META_B64` (экспорт slim — только cookies hh.ru, ~11 KB; полный файл ~650 KB в secret не влезает).

Только scrape (без restore из secret):

```bash
npm run hh:scrape
```

Подробнее: [docs/SCRAPING.md](docs/SCRAPING.md)

## AI-ранжирование (DeepSeek)

1. В `.env`: `DEEPSEEK_API_KEY` (ключ с https://platform.deepseek.com/api_keys)
2. Оценка вакансий без `analyses`:

```bash
npm run ai:rank
```

Профиль и правила оценки — Markdown в `content/` (в т.ч. **нет высшего образования**).

Подробнее: [docs/AI_RANK.md](docs/AI_RANK.md), автоотклик: [docs/APPLY.md](docs/APPLY.md), БД: [docs/DATABASE.md](docs/DATABASE.md)

### GitHub Actions cron

Ежедневный workflow: `.github/workflows/hh-pipeline.yml`

- расписание **3 раза в день по МСК**: 08:17 / 13:17 / 18:17 (`17 5`, `17 10`, `17 15` UTC)
- ручной запуск: **Actions → HH Pipeline → Run workflow**
- шаги: проверка сессии → scrape → rank → apply → cleanup
- логин в CI **не выполняется** — только cookies из secret; как их обновить: [docs/AUTH.md](docs/AUTH.md)
- `APPLY_DRY_RUN` по умолчанию `true` (секрет можно поставить в `false` для реальной отправки)
- `RETENTION_INLINE=false` — чистка вакансий один раз в конце, не после каждого шага

Нужные GitHub Secrets:

- `DATABASE_URL`
- `DIRECT_URL`
- `HH_AUTH_STATE_B64` — slim base64 cookies hh.ru (`npm run hh:auth:export`, лимит GitHub 64 KB)
- `HH_AUTH_META_B64` — base64 `.auth/hh-session.meta.json` (опционально)
- `DEEPSEEK_API_KEY`
- `APPLY_DRY_RUN` (`true` для безопасного dry-run, `false` для реальной отправки)

`HH_EMAIL` / `HH_PASSWORD` в CI не нужны — только для локального `playwright:auth`.

### Альтернатива: API (токен приложения)

Если dev.hh.ru выдал токен приложения:

```bash
npm run hh:sync
# или POST /internal/hh/sync с x-cron-secret
```

Это **не** замена откликам и **не** OAuth соискателя. Токен не refresh-ится сам — [docs/AUTH.md](docs/AUTH.md).

## Scripts

| Script                    | Description                              |
| ------------------------- | ---------------------------------------- |
| `npm run dev`             | Dev server with hot reload               |
| `npm run build`           | Compile TypeScript                       |
| `npm run start`           | Run compiled app                         |
| `npm run lint`            | ESLint                                   |
| `npm run db:migrate`      | Apply migrations                         |
| `npm run db:studio`       | Prisma Studio                            |
| `npm run hh:run`          | Restore session + search + vacancy pages → DB |
| `npm run hh:scrape`       | Scrape без логина (нужна сессия в `.auth/`)   |
| `npm run ai:rank`         | DeepSeek → score в `analyses`              |
| `npm run db:cleanup`      | Удаление вакансий старше N дней (retention) |
| `npm run hh:apply`        | Отклик по score (см. APPLY_DRY_RUN)         |
| `npm run hh:pipeline`     | restore → scrape → rank → apply             |
| `npm run playwright:auth` | Логин → `.auth/hh-user.json` (локально)     |
| `npm run hh:auth:check`   | Проверка, что cookies живые                 |
| `npm run hh:auth:export`  | Base64 сессии для GitHub Secrets            |
| `npm run hh:sync`         | HeadHunter API sync (if token available) |

## Resume content

Мастер-резюме: [`content/resume/master.md`](content/resume/master.md). См. [docs/RESUME_SYNC.md](docs/RESUME_SYNC.md).

Сжатая выжимка для AI-ранжирования: [`content/candidate-profile.md`](content/candidate-profile.md).

## Project structure

```
content/           # профиль, письмо, резюме — правите вы, не агент
docs/
  PROVIDERS.md     # мастер-схемы HH и LinkedIn
  AUTH.md          # как обновлять cookies и токены
src/
  providers/       # контракт борда: hh.ts (active), linkedin.ts (planned)
  playwright/      # HH UI: login, search, vacancy, apply
  services/        # scrape / rank / apply / retention
  integrations/    # HH API, DeepSeek
  api/             # Fastify: health + запасной hh:sync
prisma/
scripts/
```

## Roadmap

- [x] Stage 0 — project init, Prisma schema
- [x] Stage 1 — HH API integration
- [x] Stage 2 — Playwright ingestion → `vacancies`
- [x] Stage 3 — DeepSeek ranking → `analyses`
- [x] Stage 5 — Playwright auto-apply → `applications`
- [x] Stage 6 — GitHub Actions cron (`hh:pipeline`)
- [x] `vacancies.provider` + `external_id` вместо голого `hh_id`
- [ ] LinkedIn Jobs — схема БД готова, рантайма нет
