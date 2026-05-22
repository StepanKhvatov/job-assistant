# Stage 3 — AI ranking (DeepSeek)

Оценка вакансий из `vacancies` → запись в `analyses`.

## Промпты (Markdown)

| Файл | Назначение |
| ---- | ---------- |
| `content/candidate-profile.md` | Сжатая выжимка для ранжирования (синхрон с `content/resume/master.md`) |
| `content/rank-system.md` | Правила score и формат JSON |

Редактируйте без изменения TypeScript. После правок снова `npm run ai:rank`.

## Env

```env
DEEPSEEK_API_KEY=sk-...
# AI_RANK_LIMIT=20
# AI_RANK_DELAY_MS=500
```

## Команда

```bash
npm run ai:rank
```

Только вакансии **без** `analyses`, с непустым `description`.

## База

Связь `analyses.vacancy_id` → `vacancies.id` — см. [DATABASE.md](./DATABASE.md).

```bash
npm run db:verify
```

## Дальше

Автоотклик: [APPLY.md](./APPLY.md).
