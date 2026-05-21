# Хранение и очистка (retention)

## Политика

| Параметр | По умолчанию |
| -------- | ------------ |
| `VACANCY_RETENTION_DAYS` | `45` |
| `VACANCY_RETENTION_ENABLED` | `true` |

Удаляются вакансии, если:

1. `created_at` старше N дней  
2. **Нет** записей в `applications` (любой статус: applied, dry_run, failed, …)

`analyses` удаляются каскадом вместе с вакансией.

## Запуск

Автоматически после `hh:scrape`, `ai:rank`, `hh:apply`. Вручную: `npm run db:cleanup`.
