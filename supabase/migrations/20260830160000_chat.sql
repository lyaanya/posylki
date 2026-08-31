-- E09 (чат): переписка один на один, привязанная к паре «пользователь +
-- объявление» (ТЗ п.9.1). owner_id всегда владелец listing_id — второй
-- участник (other_user_id) однозначно определяет чат вместе с объявлением,
-- независимо от того, кто написал первым.
--
-- Не входит в этот проход:
-- 1. Настоящий Supabase Realtime — клиенты подписывались бы на изменения
--    напрямую из браузера, а это единственный сценарий в продукте, где
--    авторизация шла бы через RLS-политики, а не через бэкенд (ТЗ E01,
--    техдетали: "Логика доступа реализуется в бэкенде, а не в политиках
--    RLS"). Заводить RLS-политики ради одной фичи — решение, которое стоит
--    обсудить отдельно, а не тихо внести. Пока — поллинг с фронтенда.
-- 2. Системные сообщения по событиям сделки (п.9.6) — сделок (E10) ещё
--    нет, событий для системных сообщений неоткуда взяться. Тип 'system'
--    в схеме уже есть, метод создания такого сообщения — тоже (см.
--    chat.repository.ts, createSystemMessage) — воспользоваться некому.
-- 3. Доступ модератора к переписке с записью в audit_log (п.9.23) — ждёт
--    админ-панели (E16) и жалоб (E12), которых нет.

create table chats (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings (id) on delete cascade,
  owner_id uuid not null references users (id) on delete cascade,
  other_user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, other_user_id),
  check (owner_id <> other_user_id)
);

create index chats_owner_idx on chats (owner_id);
create index chats_other_user_idx on chats (other_user_id);
create index chats_listing_idx on chats (listing_id);

create trigger set_chats_updated_at
  before update on chats
  for each row execute function set_updated_at();

-- Сообщения не редактируются и не удаляются (ТЗ п.9.8) — поэтому здесь
-- сознательно нет updated_at и триггера на него: редактировать нечему.
create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats (id) on delete cascade,
  -- null — системное сообщение (п.9.6), у него нет автора-пользователя.
  sender_id uuid references users (id) on delete set null,
  kind text not null check (kind in ('text', 'photo', 'system')),
  body text,
  created_at timestamptz not null default now()
);

create index messages_chat_created_idx on messages (chat_id, created_at);

create table message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages (id) on delete cascade,
  -- Путь в приватном бакете chat-attachments, не публичный URL (п.9.24) —
  -- ссылка выдаётся временной, на чтение, только участникам чата.
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index message_attachments_message_idx on message_attachments (message_id);

create table chat_read_state (
  chat_id uuid not null references chats (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

-- Личная блокировка собеседника (ТЗ п.9.20) — отдельно от сервисной
-- блокировки (users.is_blocked): не пускает только в чат друг с другом,
-- не влияет на доступ ко всему остальному сервису.
create table user_blocks (
  blocker_id uuid not null references users (id) on delete cascade,
  blocked_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table chats enable row level security;
alter table messages enable row level security;
alter table message_attachments enable row level security;
alter table chat_read_state enable row level security;
alter table user_blocks enable row level security;

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 5242880)
on conflict (id) do nothing;
