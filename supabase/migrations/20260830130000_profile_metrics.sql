-- E06 (профиль): город проживания и показатели репутации. Рейтинг, число
-- сделок и частые маршруты денормализуются в users и пересчитываются
-- событийно при завершении сделки / публикации отзыва (E10/E11 п. 6.13-6.15)
-- — оба эпика ещё не реализованы, поэтому пока это просто пустая/нулевая
-- схема, готовая под будущий пересчёт, без самой логики пересчёта.
alter table users
  add column city_id uuid references cities (id),
  add column courier_rating numeric(3, 2),
  add column courier_deals_count integer not null default 0,
  add column customer_rating numeric(3, 2),
  add column customer_deals_count integer not null default 0,
  add column frequent_routes jsonb not null default '[]'::jsonb;

create index users_city_idx on users (city_id);

-- Публичный бакет для фотографий профиля (E06 п. 6.12) — в отличие от
-- сканов документов верификации (E04), это не чувствительные данные.
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)
on conflict (id) do nothing;
