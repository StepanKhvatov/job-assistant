# Stage 4 — Telegram (черновик)

## Цель

Показать пользователю вакансии с лучшим `score` из `analyses`, получить решение → записать `apply_decision`.

## Данные

```sql
-- кандидаты для показа (пример)
vacancies JOIN analyses ON analyses.vacancy_id = vacancies.id
ORDER BY analyses.score DESC
WHERE analyses.apply_decision IS NULL
```

## Env (план)

```env
TELEGRAM_BOT_TOKEN=
```

## Поток

1. `/top` или cron-push — список карточек (title, company, score, summary, url)
2. Inline-кнопки: ✅ откликнуть / ❌ пропустить
3. `apply_decision = true|false` в последней `analyses` по вакансии
4. Stage 5 — отклик только где `apply_decision = true`

## Зависимости

- Stage 3 ✅ (`analyses`, промпты в `content/`)
- Профиль кандидата: `content/candidate-profile.md`
