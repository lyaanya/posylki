-- Основные таблицы с данными пользователей: профиль, верификация,
-- юридические документы и согласия, сотрудники. Авторизация как таковая
-- (пароли, токены) остаётся в auth.users — встроенной таблице Supabase Auth,
-- её мы не создаём и не дублируем.
--
-- document_type в этой миграции — свободный текст, а не внешний ключ:
-- справочник document_types появится вместе с остальными справочниками
-- отдельно и превратит это поле в полноценную ссылку без потери данных.

-- === users ===============================================================
-- Профиль поверх auth.users, id совпадает с id записи Supabase Auth.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  phone text,
  first_name text,
  last_name text,
  avatar_url text,
  about_text text,
  date_of_birth date,
  document_type text,
  document_number_hash text,
  verification_status text not null default 'not_submitted'
    check (verification_status in ('not_submitted', 'pending', 'approved', 'rejected')),
  verified_at timestamptz,
  verified_by_admin_id uuid,
  referred_by_id uuid references users (id),
  is_blocked boolean not null default false,
  blocked_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_referred_by_idx on users (referred_by_id);

create trigger set_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- === admin_users ==========================================================
-- Сотрудники сервиса — тоже через Supabase Auth, отдельная запись профиля
-- с ролью. Создаётся вручную (приглашение сотрудника), без автотриггера.
create table admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'moderator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_admin_users_updated_at
  before update on admin_users
  for each row execute function set_updated_at();

-- Теперь, когда admin_users существует, можно связать users.verified_by_admin_id.
alter table users
  add constraint users_verified_by_admin_id_fkey
  foreign key (verified_by_admin_id) references admin_users (id);

-- === verification_requests ===============================================
create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  document_type text not null,
  submitted_first_name text not null,
  submitted_last_name text not null,
  submitted_date_of_birth date not null,
  document_number_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason_code text,
  rejection_comment text,
  reviewed_by_admin_id uuid references admin_users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index verification_requests_user_idx on verification_requests (user_id);
create index verification_requests_status_idx on verification_requests (status);

create trigger set_verification_requests_updated_at
  before update on verification_requests
  for each row execute function set_updated_at();

-- === legal_documents ======================================================
create table legal_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('terms', 'privacy', 'service_rules', 'consent')),
  version integer not null,
  title text not null,
  body_markdown text not null,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (type, version)
);

-- === legal_consents =======================================================
create table legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  legal_document_id uuid not null references legal_documents (id),
  accepted_at timestamptz not null default now(),
  method text not null check (method in ('registration', 'reacceptance'))
);

create index legal_consents_user_idx on legal_consents (user_id);

-- === автосоздание профиля при регистрации ================================
-- Работает для любого способа входа (email, Google и т.д. в будущем) —
-- профиль появляется независимо от того, как именно человек зарегистрировался.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- === Row Level Security ===================================================
-- Включаем RLS без единой разрешающей политики: анонимный и обычный
-- пользовательский ключ Supabase (публичный, зашит в клиентские приложения)
-- не сможет читать или писать сюда напрямую в обход нашего API. Наш бэкенд
-- ходит через service-ключ, который RLS не ограничивает.
alter table users enable row level security;
alter table admin_users enable row level security;
alter table verification_requests enable row level security;
alter table legal_documents enable row level security;
alter table legal_consents enable row level security;
