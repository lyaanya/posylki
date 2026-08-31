-- E14 (уведомления). RLS без политик — как везде, авторизация в NestJS.
--
-- Область этой миграции сознательно уже, чем полный список событий из ТЗ
-- 14.5: verification_result ждёт E04 (верификации ещё нет), support_reply
-- ждёт E15 (поддержки ещё нет), subscription_match отложен — событие
-- существует (subscription_matches из E08), но почасовая группировка
-- (14.15) требует отдельного cron и колонки notified_at, которых пока нет.
-- Список событий здесь — то, что реально порождается кодом сегодня;
-- остальные добавятся миграцией при подключении, без ломки существующих.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  event text not null check (
    event in (
      'chat_message',
      'deal_created',
      'deal_status_changed',
      'deal_overweight_reconfirm',
      'storage_extension_requested',
      'storage_extension_decided',
      'storage_reminder',
      'review_published',
      'complaint_decided',
      'moderator_warning'
    )
  ),
  title text not null,
  body text not null,
  deep_link text not null,
  -- Структурные данные конкретного события (chatId, dealId и т.п.) — для
  -- дедупликации/группировки и на будущее для рендера каналов push/email.
  payload jsonb not null default '{}',
  is_urgent boolean not null default false,
  -- Тихие часы (14.10-14.13): пока send_after в будущем, отправка
  -- откладывается, но запись уже существует — это и есть "список
  -- уведомлений в приложении" (14.21), не дожидающийся отправки во внешние
  -- каналы.
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  -- ТЗ п.14.18 — до трёх повторов с нарастающим интервалом; относится к
  -- последней попытке отправки во внешние каналы. Запись остаётся одним
  -- логическим ин-апп элементом на событие (14.21), не строкой на канал.
  retry_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_pending_idx on notifications (send_after) where sent_at is null;

alter table notifications enable row level security;

-- Настройки по группам событий (14.7-14.9). Группа "сделки" не имеет
-- смысла делать отключаемой в БД: политика "нельзя отключить" проще и
-- надёжнее как отказ в API (см. NotificationsController), чем как
-- порождающая тройка колонок, которые всё равно всегда true. Поэтому
-- здесь только три группы, которыми пользователь реально управляет.
create table notification_settings (
  user_id uuid primary key references users (id) on delete cascade,
  messages_push boolean not null default true,
  messages_email boolean not null default true,
  messages_telegram boolean not null default true,
  listings_push boolean not null default true,
  listings_email boolean not null default true,
  listings_telegram boolean not null default true,
  service_push boolean not null default true,
  service_email boolean not null default true,
  service_telegram boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_notification_settings_updated_at
  before update on notification_settings
  for each row execute function set_updated_at();

alter table notification_settings enable row level security;

-- Токены мобильных устройств для push (14.5/14.19). Таблица и эндпоинт
-- регистрации — настоящие; самой отправки через APNs/FCM в этой итерации
-- нет (нет сертификата Apple и проекта Firebase — см. BACKLOG/отчёт
-- эпика), поэтому канал "push" сегодня недоступен, но токены не теряются.
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index device_tokens_user_idx on device_tokens (user_id);

alter table device_tokens enable row level security;

-- Привязка Telegram (14.3) — одноразовый токен выдаётся пользователю по
-- запросу, дальше должен подтверждаться ботом. Бота ещё нет (нет
-- Bot API токена), поэтому telegram_chat_id остаётся null у всех — но
-- сама привязка (генерация токена) реализована и готова к подключению.
create table telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users (id) on delete cascade,
  link_token text not null unique,
  telegram_chat_id text,
  created_at timestamptz not null default now(),
  linked_at timestamptz
);

alter table telegram_links enable row level security;
