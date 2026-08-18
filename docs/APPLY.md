# Автоотклик (Playwright)

Без Telegram. Шаг `apply` использует `content/cover-letter.md` как fallback и пытается сгенерировать короткое письмо под вакансию через DeepSeek.

Сессия должна быть живой: [AUTH.md](./AUTH.md). LinkedIn apply — только в схеме, рантайма нет: [PROVIDERS.md](./PROVIDERS.md).

Отклик **отправляется** (кнопка Submit нажимается). Старые записи `applications.status = dry_run` можно повторить.

## Два способа запуска отклика

| Способ | Где в IDE | БД `applications` |
| ------ | --------- | ----------------- |
| **`npm run hh:apply`** | Скрипт `scripts/hh-apply-once.ts` | ✅ пишет |
| **`npm run playwright:apply`** | Тест `src/playwright/apply.scrape.ts` | ❌ только UI |

В Test Explorer видны только файлы `*.scrape.ts` и `auth.setup.ts`. Логика отклика HH: `src/playwright/apply.ts`, вызов через `getPlaywrightAdapter("hh")`.

## Цепочка (продакшен)

```bash
npm run hh:scrape    # вакансии в БД
npm run ai:rank      # analyses.score
npm run hh:apply     # отклик на hh.ru → applications
```

## Тест одной вакансии (Playwright UI)

Реальный отклик, без записи в БД:

```bash
# в .env: HH_VACANCY_ID=132469416
npm run playwright:apply
```

Полный прогон (с логином):

```bash
HEADLESS=false npm run playwright:auth
npm run hh:scrape && npm run ai:rank && npm run hh:apply
```

## Env

Дефолты в коде / схеме борда. Переопределять только если нужно:

```env
APPLY_MIN_SCORE=60
APPLY_MAX_PER_RUN=30
APPLY_DELAY_MS=3000
```

## Кого откликаем

- Есть `analysis` с `score >= APPLY_MIN_SCORE`
- Нет записи с блокирующим статусом: `applied`, `already_applied`, `skipped_foreign_country`, `skipped_questionnaire`
- Повтор возможен после `dry_run` (legacy), `failed`, `unconfirmed`, `no_response_button`
- Сортировка: сначала выше score

## Сопроводительное

Редактируйте **`content/cover-letter.md`** — это fallback-стиль и запасной текст, если генерация через DeepSeek недоступна или упала.

Генерация письма:
- на вход идут профиль кандидата, базовое письмо, title/company/description вакансии
- DeepSeek пишет короткое и простое письмо под конкретную вакансию
- если генерация не удалась, используется fallback из `content/cover-letter.md`

## Статусы `applications.status`

| status | Значение |
| ------ | -------- |
| `applied` | Отклик отправлен |
| `dry_run` | Legacy: форма была заполнена без submit. Новые записи не создаются, повтор возможен |
| `already_applied` | Уже откликались на hh.ru |
| `no_response_button` | Нет кнопки отклика |
| `skipped_foreign_country` | Popup «вакансия в другой стране» — пропуск |
| `skipped_questionnaire` | Анкета/вопросы работодателя — автоматический отклик невозможен |
| `failed` | Ошибка UI / скрипта |
| `unconfirmed` | Submit нажат, текст успеха не появился — не считаем отклик состоявшимся, повтор возможен |

Фильтр по тестовым заданиям **не реализован** — добавим при необходимости.

## Риски

Капча, лимиты hh.ru — держите `APPLY_MAX_PER_RUN` низким и `APPLY_DELAY_MS` ≥ 3000 (или не задавайте: возьмётся из схемы борда).
