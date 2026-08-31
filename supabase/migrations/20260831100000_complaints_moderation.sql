-- E12 (жалобы, модерация, блокировки). RLS без политик, как везде: вся
-- авторизация в NestJS, не в базе (E01).
--
-- complaints.target_id — намеренно без FK: цель полиморфна (пользователь,
-- сообщение, объявление, отзыв, сделка) в зависимости от target_type,
-- как и entity_id в audit_log. Фотографии-доказательства — простой
-- text[] на самой жалобе, а не отдельная таблица с бакетом: их немного,
-- у них нет собственных метаданных, заводить ради этого reviews/deal_photos
-- по образцу — лишняя сущность.
create table complaints (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'message', 'listing', 'review', 'deal')),
  target_id uuid not null,
  category text not null check (
    category in ('fraud', 'prohibited_item', 'rudeness', 'breach_of_agreement', 'fake_documents', 'spam', 'other')
  ),
  comment text,
  photo_paths text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index complaints_target_idx on complaints (target_type, target_id);
create index complaints_author_idx on complaints (author_id);
create index complaints_status_idx on complaints (status);

-- ТЗ п.12.5 — не более одной АКТИВНОЙ жалобы от пользователя на один объект;
-- решённые/отклонённые не мешают пожаловаться повторно.
create unique index complaints_one_active_per_target
  on complaints (author_id, target_type, target_id)
  where status in ('pending', 'reviewing');

create trigger set_complaints_updated_at
  before update on complaints
  for each row execute function set_updated_at();

-- Структурированный результат разбора — отдельно от audit_log (12.11),
-- который остаётся сквозным журналом по всем эпикам; эта таблица нужна,
-- чтобы у жалобы/проблемной сделки был явный статус решения и история
-- прошлых решений по пользователю (12.13).
create table moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references complaints (id) on delete set null,
  deal_id uuid references deals (id) on delete set null,
  moderator_id uuid references admin_users (id) on delete set null,
  action text not null check (action in ('reject', 'warn', 'hide_listing', 'remove_review', 'ban_user')),
  reason text not null,
  created_at timestamptz not null default now()
);

create index moderation_decisions_complaint_idx on moderation_decisions (complaint_id);
create index moderation_decisions_deal_idx on moderation_decisions (deal_id);

-- ТЗ п.12.12-12.13 — показывается при следующем входе, требует подтверждения.
create table user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  issued_by uuid references admin_users (id) on delete set null,
  complaint_id uuid references complaints (id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index user_warnings_user_idx on user_warnings (user_id);

-- ТЗ п.12.14-12.19 — насыщенная запись блокировки; users.is_blocked/
-- blocked_reason остаются быстрым денормализованным флагом (как рейтинг
-- в E11), который держит в актуальном состоянии код приложения, а не база.
create table user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  banned_by uuid references admin_users (id) on delete set null,
  complaint_id uuid references complaints (id) on delete set null,
  reason text not null,
  -- null — бессрочная блокировка (12.14).
  banned_until timestamptz,
  is_active boolean not null default true,
  unbanned_at timestamptz,
  unbanned_by uuid references admin_users (id) on delete set null,
  unban_reason text,
  created_at timestamptz not null default now()
);

create index user_bans_user_idx on user_bans (user_id);
create index user_bans_active_idx on user_bans (is_active, banned_until);

alter table complaints enable row level security;
alter table moderation_decisions enable row level security;
alter table user_warnings enable row level security;
alter table user_bans enable row level security;

-- ТЗ п.12.17/E03 п.22 — удаление аккаунта должно суметь проставить дату
-- удаления; сейчас deleted_at запрещал запись на уровне TS-типов (Kysely
-- ColumnType<Date|null, never, never>), потому что эндпоинта удаления
-- ещё не существовало вовсе (см. deals.controller.ts комментарии по духу —
-- сначала честно фиксируем пробел, потом чиним). Сама колонка не менялась,
-- меняется только её описание в коде (auth.types.ts), эта миграция —
-- просто маркер того, что теперь есть настоящий писатель.
comment on column users.deleted_at is 'Момент soft-delete аккаунта (E03/E12 п.12.17) — хэш документа при этом сохраняется.';
