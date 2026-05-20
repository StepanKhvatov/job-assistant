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

2. Fill `DATABASE_URL` (pooler) and `DIRECT_URL` (direct) from Supabase → **Project Settings → Database**.

3. Install and generate Prisma client:

```bash
npm install
npm run db:generate
npm run db:migrate
```

4. Start the API:

```bash
npm run dev
```

5. Check health:

- http://localhost:3000/health
- http://localhost:3000/health/db

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled app |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Prisma Studio |

## Project structure

```
src/
  api/           # HTTP routes
  config/        # env schema
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
```

## Roadmap

- [x] Stage 0 — project init, Prisma schema
- [ ] Stage 1 — HH API integration
- [ ] Stage 2 — ingestion pipeline
- [ ] Stage 3 — AI ranking
- [ ] Stage 4 — Telegram bot
- [ ] Stage 5 — Playwright apply
- [ ] Stage 6 — GitHub Actions cron
