# VEZZY

P2P-доставка посылок с попутчиками — маркетплейс, соединяющий отправителей
и путешественников со свободным местом в багаже. MVP ориентирован на
русскоязычных экспатов, маршруты Россия ↔ Вьетнам/СНГ.

Полное ТЗ — в [`docs/tz/`](docs/tz/epic-00-overview.md), список отложенных
на будущее фич — в [`BACKLOG.md`](BACKLOG.md).

## Стек

- Монорепозиторий на pnpm workspaces
- `apps/api` — бэкенд на NestJS (ESM, строгий TypeScript), Kysely поверх Postgres
- `apps/web` — публичный сайт на Next.js
- `apps/admin` — админ-панель на Next.js
- `packages/contracts` — OpenAPI-спецификация и сгенерированные клиенты
- База данных и авторизация — Supabase (Postgres + Auth)

## Предварительные требования

- Node.js **22+**
- pnpm **11** (`corepack enable` подхватит нужную версию из `packageManager` в `package.json`)
- Аккаунт и проект в [Supabase](https://supabase.com)
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `brew install supabase/tap/supabase`
- Опционально, только для генерации клиентов из OpenAPI: `brew install openapi-generator` (нужна Java)

## Развёртывание с нуля

### 1. Установить зависимости

```bash
pnpm install
```

### 2. Настроить окружение бэкенда

```bash
cp .env.example .env
```

Заполните в `.env`:

- `SUPABASE_URL` — адрес вашего проекта (Project Settings → API)
- `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` — там же
- `SUPABASE_DB_URL` — Project Settings → Database → Connection string →
  **Transaction pooler**, с подставленным паролем от базы
- `GROQ_API_KEY` — необязателен: без него ИИ-сервис (разбор свободного
  текста объявления, E13) отвечает сбоем, но не роняет приложение.
  Бесплатный ключ — console.groq.com → API Keys

### 3. Настроить окружение веб-приложения

Создайте `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Первые два значения те же, что `SUPABASE_URL`/`SUPABASE_ANON_KEY` из `.env`.
`NEXT_PUBLIC_API_URL` — адрес `apps/api`, локально всегда `http://localhost:3000`;
без него не заработают справочники (города, стоп-лист) и ИИ-разбор текста.

### 4. Применить миграции базы данных

```bash
supabase link --project-ref <ваш-project-ref>
supabase db push --linked
```

### 5. Запустить всё локально

```bash
pnpm dev
```

Поднимутся параллельно:

- `apps/api` — http://localhost:3000 (Swagger UI на `/docs`)
- `apps/web` — http://localhost:3002
- `apps/admin` — http://localhost:3001

### 6. Проверить, что всё работает

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ — `200` с `"database": "ok"`. Затем откройте
http://localhost:3002/login и убедитесь, что форма входа рендерится.

## Частые команды

| Команда | Что делает |
|---|---|
| `pnpm lint` | ESLint по всему репозиторию |
| `pnpm format` / `pnpm format:check` | Prettier — исправить / только проверить |
| `pnpm typecheck` | Проверка типов во всех пакетах |
| `pnpm test` | Тесты во всех пакетах |
| `pnpm build` | Сборка всех пакетов |
| `pnpm contracts:generate` | Пересобрать `openapi.json` из кода API + TypeScript-клиент |
| `supabase migration new <имя>` | Создать новую миграцию |
| `supabase db push --linked` | Применить локальные миграции к связанному проекту Supabase |

## Структура репозитория

```
apps/
  api/      NestJS-бэкенд
  web/      публичный сайт (Next.js)
  admin/    админ-панель (Next.js)
packages/
  contracts/  openapi.json + сгенерированные клиенты
  shared/     общий код между пакетами
supabase/
  migrations/ SQL-миграции
docs/tz/      техническое задание по эпикам
```

## CI

`.github/workflows/ci.yml` гоняет линтинг, типы, сборку и (при наличии
секрета `SUPABASE_DB_URL` в настройках репозитория) тесты и проверку
актуальности `openapi.json`. Без секретов CI всё равно зелёный — эти шаги
просто пропускаются.

## Продакшн

Публичный сайт: https://vezzy.annanotperfect.com — на том же VPS, что и
`n8n` (Caddy как общий reverse proxy, TLS выпускается автоматически).

- `apps/web` (контейнер `posylki-web`) обслуживает `/`.
- `apps/api` (контейнер `posylki-api`) обслуживает `/api/*` — Caddy снимает
  префикс `/api` (`handle_path`), сам бэкенд остаётся без префикса в коде.
- Оба контейнера — в сети `n8n-docker-caddy_default`, конфиг Caddy лежит
  в `/home/n8n-admin/n8n-docker-caddy/caddy_config/Caddyfile` на сервере.
- Реальные `.env`/`.env.local` живут только на сервере (`apps/api/.env`,
  `apps/web/.env.local`), в git не попадают.

Передеплой после `git push`: `rsync` актуального кода на сервер (исключая
`node_modules`, `.env*`, `.git` — см. историю деплоя), затем на сервере —
`docker compose build && docker compose up -d --force-recreate` в
`apps/web` и/или `apps/api`. `.env.local`/`.env` на сервере не тронуть.

**Важно про Caddyfile**: он смонтирован в контейнер как файл, не как
папка (`docker inspect` → `Mounts`). Правка через `sed -i` заменяет инод
файла и рвёт эту привязку — контейнер продолжает видеть старое
содержимое, а `caddy reload` тогда молча ничего не делает. Править только
перезаписью через `cat > файл << EOF ... EOF` (тот же инод) — тогда
`docker exec ... caddy reload --config /etc/caddy/Caddyfile` подхватывает
изменения сразу, без пересоздания контейнера.

## Известные ограничения

- Мобильное приложение (React Native + Expo, задача 1.11 в [epic-01](docs/tz/epic-01-foundation.md))
  пока не реализовано — сфокусировались на web.
- Бэкенд объявлений и сделок (E07, E10) ещё не реализован: справочники
  (города, стоп-лист) и ИИ-разбор текста на публичном сайте работают через
  настоящий `apps/api`, но сама публикация объявления нигде не сохраняется —
  экраны черновика/публикации собраны так, чтобы их было легко подключить
  к реальному API позже.
- `apps/admin` — только каркас Next.js, без интерфейса под уже готовый
  API справочников (`/admin/directories/*`, E05 п. 5.6).
- Вход через Apple/Telegram (E03 п. 3.3) не настроен — нужны реальные
  учётные данные провайдеров, ещё не заведены.
