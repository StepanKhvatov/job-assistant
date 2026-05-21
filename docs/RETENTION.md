# Хранение и очистка (retention)

## Почему не TTL в Postgres

В Supabase/Postgres нет встроенного TTL как в Redis. Обычно делают **политику хранения + периодический DELETE**.

## Выбранная политика

| Параметр | Значение по умолчанию |
| -------- | --------------------- |
| `VACANCY_RETENTION_DAYS` | `45` |
| `VACANCY_RETENTION_ENABLED` | `true` |

Удаляются вакансии, если **все** условия выполнены:

1. `vacancies.created_at` старше N дней  
2. **Нет** analysis с `apply_decision = true` (одобрено в Telegram)  
3. **Нет** записей в `applications` (будущие отклики)

`analyses` и `applications` удаляются каскадом (`ON DELETE CASCADE`).

## Когда запускается

- В конце `npm run hh:scrape`
- В конце `npm run ai:rank`
- Вручную: `npm run db:cleanup`

## Отключить

```env
VACANCY_RETENTION_ENABLED=false
# или
VACANCY_RETENTION_DAYS=0
```

## Альтернативы (не используем сейчас)

| Подход | Минус |
| ------ | ----- |
| Лимит «хранить 500 последних» | Сложнее объяснить, дубли по `hh_id` |
| Архивная таблица | Лишняя схема для личного проекта |
| Только pg_cron в Supabase | Дублирует логику вне репозитория |

При росте нагрузки можно добавить **pg_cron** в Supabase с тем же SQL, что в `cleanupStaleVacancies`.
