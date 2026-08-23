-- Список активных сессий пользователя (E03 п. 3.9): устройство, когда началась,
-- когда последний раз использовалась, отозвана ли. Не заменяет собственный
-- механизм сессий Supabase Auth (refresh-токены остаются на его стороне) —
-- это отдельный журнал для экрана «Активные сессии» и точечного завершения
-- одной из них по запросу пользователя.

create table user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  -- session_id из access-токена Supabase Auth (claim "session_id" / "sid") —
  -- по нему сессия находится и завершается через Admin API при выходе.
  supabase_session_id uuid not null unique,
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index user_sessions_user_idx on user_sessions (user_id);

alter table user_sessions enable row level security;
