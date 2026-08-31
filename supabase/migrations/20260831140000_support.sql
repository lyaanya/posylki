-- E15 (поддержка). Переиспользует chats/messages из E09 (15.1, тех. детали
-- эпика) — отдельная система сообщений не создаётся. У обращения в
-- поддержку нет объявления, поэтому listing_id становится необязательным,
-- а kind различает обычный чат по объявлению и чат поддержки.
alter table chats alter column listing_id drop not null;
alter table chats add column kind text not null default 'user' check (kind in ('user', 'support'));

-- Второй участник каждого чата поддержки — общий аккаунт "Поддержка", а не
-- конкретный модератор: ответить может любой дежурный, не только тот, кто
-- создал чат. Обычная строка auth.users — триггер on_auth_user_created
-- сам создаст соответствующую public.users.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'support@vezzy.internal')
  on conflict (id) do nothing;
update users set first_name = 'Поддержка VEZZY' where id = '00000000-0000-0000-0000-000000000001';

-- ИИ-ассистент (сценарии 15.7-15.14, задачи 15.4-15.5) — nice-to-have,
-- явно помечен в ТЗ как режущийся первым при нехватке времени (15.14),
-- с явно описанным поведением на этот случай: "обращения сразу уходят к
-- человеку". Статусы ниже отражают именно этот путь — new/awaiting_moderator
-- вместо полного new/with_assistant/awaiting_moderator/in_progress/closed;
-- with_assistant и счётчик неудачных попыток можно добавить позже без
-- миграции существующих строк, когда сценарий 4 будет подключён.
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  chat_id uuid not null references chats (id) on delete cascade,
  status text not null default 'awaiting_moderator'
    check (status in ('awaiting_moderator', 'in_progress', 'closed')),
  -- Привязка к объекту (15.5) — без FK, как и везде для полиморфных целей
  -- (см. complaints.target_id, audit_log.entity_id).
  linked_object_type text check (linked_object_type in ('deal', 'listing', 'verification')),
  linked_object_id uuid,
  -- Контекст, собранный автоматически при создании (15.4) — виден только модератору.
  context jsonb not null default '{}',
  claimed_by uuid references admin_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index support_tickets_user_idx on support_tickets (user_id);
create index support_tickets_status_idx on support_tickets (status);
-- ТЗ п.15.3 — одно активное обращение на пользователя.
create unique index support_tickets_one_active_per_user on support_tickets (user_id) where status <> 'closed';

create trigger set_support_tickets_updated_at
  before update on support_tickets
  for each row execute function set_updated_at();

alter table support_tickets enable row level security;

-- ТЗ п.15.21-15.22 — база типовых ответов; ведётся в админ-панели (E16,
-- ещё нет — см. отчёт эпика), здесь только хранилище и API.
create table support_faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_support_faq_updated_at
  before update on support_faq
  for each row execute function set_updated_at();

alter table support_faq enable row level security;
