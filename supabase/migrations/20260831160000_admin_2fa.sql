-- E16 п.16.2-16.3, 16.5 — двухфакторная аутентификация обязательна для
-- входа в админ-панель, сессия сотрудника истекает после 12 часов
-- бездействия. totp_secret заводится один раз при первом входе (пока
-- пуст — обычный пароль ещё не даёт полного доступа, см. AdminIdentityGuard
-- vs AdminGuard). admin_sessions привязана к Supabase-сессии (session_id
-- из JWT, тот же claims.sessionId, что уже читает SupabaseJwtService) —
-- не отдельная система токенов, а флаг "эта сессия прошла второй фактор".
alter table admin_users add column totp_secret text;

create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admin_users (id) on delete cascade,
  supabase_session_id text not null unique,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index admin_sessions_admin_idx on admin_sessions (admin_id);

alter table admin_sessions enable row level security;
