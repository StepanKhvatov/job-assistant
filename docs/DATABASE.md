# База данных (Prisma + Supabase Postgres)

Схема: `prisma/schema.prisma`. Миграции: `prisma/migrations/`.

## Связи (FK)

| Дочерняя таблица | Колонка | Родитель | Колонка | ON DELETE |
| ---------------- | ------- | -------- | ------- | --------- |
| `analyses` | `vacancy_id` | `vacancies` | `id` | CASCADE |
| `applications` | `vacancy_id` | `vacancies` | `id` | CASCADE |

Важно: связь идёт с **`vacancies.id`** (внутренний `cuid`), **не** с `hh_id`.  
В Supabase Table Editor при настройке relation укажите именно `vacancies.id` ← `analyses.vacancy_id`.

Если в Studio написано «Has a foreign key relation to public.vacancies.id», но граф не рисуется — часто это UI-кэш:

1. **Database → Schema Visualizer → Refresh**
2. Убедитесь, что смотрите схему `public`
3. Проверьте, что миграции применены: `npm run db:migrate:deploy`

Проверка из проекта:

```bash
npm run db:verify
```

## Таблицы и поля

### `vacancies`

| Prisma | Колонка PG | Тип | Обязательно |
| ------ | ---------- | --- | ----------- |
| `id` | `id` | TEXT (PK) | да |
| `hhId` | `hh_id` | TEXT (unique) | да |
| `title` | `title` | TEXT | да |
| `company` | `company` | TEXT | нет |
| `salary` | `salary` | TEXT | нет |
| `url` | `url` | TEXT | да |
| `description` | `description` | TEXT | нет |
| `publishedAt` | `published_at` | TIMESTAMPTZ | нет |
| `createdAt` | `created_at` | TIMESTAMPTZ | да (default now) |

### `analyses`

| Prisma | Колонка PG | Тип | Обязательно |
| ------ | ---------- | --- | ----------- |
| `id` | `id` | TEXT (PK) | да |
| `vacancyId` | `vacancy_id` | TEXT (FK) | да |
| `score` | `score` | INTEGER | да |
| `summary` | `summary` | TEXT | нет |
| `pros` | `pros` | JSONB | нет |
| `cons` | `cons` | JSONB | нет |
| `applyDecision` | `apply_decision` | BOOLEAN | не используется (legacy) |
| `createdAt` | `created_at` | TIMESTAMPTZ | да |

### `applications` (auto-apply)

| Prisma | Колонка PG | Тип |
| ------ | ---------- | --- |
| `id` | `id` | TEXT (PK) |
| `vacancyId` | `vacancy_id` | TEXT (FK) |
| `status` | `status` | TEXT |
| `coverLetter` | `cover_letter` | TEXT |
| `appliedAt` | `applied_at` | TIMESTAMPTZ |
| `response` | `response` | TEXT |

## Очистка старых записей

Политика retention (45 дней по умолчанию): [RETENTION.md](./RETENTION.md).

```bash
npm run db:cleanup
```

## Подключение Supabase

- **Runtime** (`DATABASE_URL`): transaction pooler, port **6543**, `?pgbouncer=true`
- **Миграции** (`DIRECT_URL`): session pooler, port **5432**

См. `.env.example` и README.
