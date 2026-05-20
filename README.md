# job-assistant

Personal AI-assisted job search: HH.ru ingestion, AI ranking, Telegram approve/reject, semi-auto apply via Playwright.

**Stack:** Node.js, TypeScript, Fastify, Prisma, Supabase (Postgres), GitHub Actions, Telegram, DeepSeek.

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

   Лимит запросов «полного описания» за один sync: `HH_MAX_VACANCIES_DETAIL` (по умолчанию 200; список сначала сортируется по дате публикации, новые — в приоритете).

   Если `HH_KEYWORDS` и `HH_SEARCH_TEXT` не заданы, используется профиль по умолчанию из `src/config/candidate-profile.ts` (роль и короткий набор ключевых слов для hh.ru).

5. Start the API:

```bash
npm run dev
```

6. Check health:

- http://localhost:3000/health
- http://localhost:3000/health/db

## HH.ru sync (Stage 1)

Сервер запущен — один раз подтянуть вакансии в БД:

```bash
curl -sS -X POST http://localhost:3000/internal/hh/sync \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Или без HTTP-сервера (удобно для GitHub Actions):

```bash
npm run hh:sync
```

Ответ JSON: `officeCount`, `remoteCount`, `uniqueListCount`, `detailLimit`, `upserted`, `skippedOverLimit`, при ошибках по отдельным вакансиям — `errors[]`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled app |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Prisma Studio |
| `npm run hh:sync` | HeadHunter sync once (CLI) |

## Project structure

```
src/
  api/           # HTTP routes
  config/        # env schema, candidate-profile (роль/навыки без ПДн)
  db/            # Prisma client
  services/
  integrations/  # HH, DeepSeek
  workers/         # cron jobs
  telegram/
  playwright/
  prompts/
  utils/
prisma/
  schema.prisma
  migrations/
scripts/
  hh-sync-once.ts
```

## Roadmap

- [x] Stage 0 — project init, Prisma schema
- [x] Stage 1 — HH API integration
- [ ] Stage 2 — ingestion pipeline
- [ ] Stage 3 — AI ranking
- [ ] Stage 4 — Telegram bot
- [ ] Stage 5 — Playwright apply
- [ ] Stage 6 — GitHub Actions cron
