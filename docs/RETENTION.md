# Хранение и очистка (retention)

## Политика

| Параметр | По умолчанию |
| -------- | ------------ |
| `RETENTION_DAYS` | `45` |
| `RETENTION_INLINE` | `true` локально |

Удаляются вакансии, если:

1. `created_at` старше N дней  
2. **Нет** записей в `applications` (любой статус: applied, failed, …)

`analyses` удаляются каскадом вместе с вакансией.

## Запуск

Автоматически после одиночных `hh:scrape` / `ai:rank` / `hh:apply` (`RETENTION_INLINE=true` по умолчанию).

В CI и `npm run hh:pipeline` инлайн-чистка выключена (`RETENTION_INLINE=false`) — один вызов в конце: `npm run db:cleanup`.
