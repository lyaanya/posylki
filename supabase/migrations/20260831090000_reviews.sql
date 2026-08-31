-- E11 (отзывы и рейтинг) — слепая публикация, раздельный рейтинг по ролям.
-- RLS включён без политик, как и везде: авторизация в NestJS, не в базе (E01).
--
-- Модераторское удаление (ТЗ п.11.14-11.17) не убирает строку физически —
-- обнуляет rating и text, помечает moderated_at/moderated_by/moderation_reason.
-- Так уникальность (deal_id, author_id) навсегда закрывает повторную попытку
-- отзыва по той же сделке той же стороной — включая попытку "удалили,
-- напишу заново получше" (ровно то, от чего защищает 11.15).
create table reviews (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  author_id uuid not null references users (id) on delete cascade,
  subject_id uuid not null references users (id) on delete cascade,
  -- Роль, в которой оценивали SUBJECT в этой сделке (не роль автора) —
  -- определяет, в какой из двух рейтингов попадёт оценка (ТЗ п.11.10-11.11).
  role text not null check (role in ('as_courier', 'as_customer')),
  rating integer check (rating is null or rating between 1 and 5),
  text text,
  created_at timestamptz not null default now(),
  -- Слепая публикация (ТЗ п.11.5): null, пока не выполнено одно из двух
  -- условий (обе стороны написали / прошло 7 дней). Все выборки отзывов
  -- обязаны фильтровать по этому полю на бэкенде — клиент не должен
  -- получить чужой неопубликованный отзыв даже в скрытом виде.
  published_at timestamptz,
  moderated_at timestamptz,
  moderated_by uuid references admin_users (id) on delete set null,
  moderation_reason text,
  unique (deal_id, author_id)
);

create index reviews_deal_idx on reviews (deal_id);
create index reviews_author_idx on reviews (author_id);
create index reviews_subject_rating_idx on reviews (subject_id, role, published_at);

alter table reviews enable row level security;
