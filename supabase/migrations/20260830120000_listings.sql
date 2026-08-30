-- Объявления (E07, урезанный демо-срез): рейс или заявка — маршрут, дата,
-- свободный вес, цена, описание. Модерация ИИ (E13, сценарии 1-2), опись
-- содержимого и статусная модель сделки (E10) сознательно не входят —
-- это заготовка под сам факт "объявление создано и видно в ленте".
create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('trip', 'request')),
  from_city_id uuid not null references cities (id),
  to_city_id uuid not null references cities (id),
  travel_date date not null,
  free_weight_kg numeric(6, 2) not null check (free_weight_kg > 0),
  price_per_kg numeric(10, 2) not null check (price_per_kg >= 0),
  min_price numeric(10, 2) not null check (min_price >= 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_from_city_idx on listings (from_city_id);
create index listings_to_city_idx on listings (to_city_id);
create index listings_owner_idx on listings (owner_id);
create index listings_created_at_idx on listings (created_at desc);

create trigger set_listings_updated_at
  before update on listings
  for each row execute function set_updated_at();

-- RLS включена без разрешающих политик — как и остальные таблицы: доступ
-- только через бэкенд на service-ключе, не напрямую с клиента.
alter table listings enable row level security;
