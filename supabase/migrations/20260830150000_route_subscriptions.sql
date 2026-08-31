-- E08 (поиск, ленты, подписки): подписка на маршрут + журнал совпадений.
--
-- Доставка уведомлений по подпискам (ТЗ 7.11 п.8.11, "группировка отложенной
-- отправкой") не входит в этот проход: это E14, которого ещё нет. До него
-- подписки создаются и накапливают совпадения в subscription_matches —
-- сам эпик прямо разрешает такой порядок ("уведомления могут быть
-- подключены позже, вместе с E14 — до этого подписки создаются и
-- накапливают совпадения").

create table route_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  from_city_id uuid not null references cities (id),
  to_city_id uuid not null references cities (id),
  -- Необязательный диапазон дат и тип объявления — null означает "любой".
  date_from date,
  date_to date,
  listing_type text check (listing_type in ('trip', 'request')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index route_subscriptions_user_idx on route_subscriptions (user_id);
create index route_subscriptions_route_idx on route_subscriptions (from_city_id, to_city_id);

create trigger set_route_subscriptions_updated_at
  before update on route_subscriptions
  for each row execute function set_updated_at();

alter table route_subscriptions enable row level security;

-- Совпадение подписки с объявлением, вычисляется при публикации (ТЗ, техдетали
-- эпика: "не периодическим обходом всех подписок"). unique — повторная
-- публикация того же объявления (правка) не плодит дублей совпадений.
create table subscription_matches (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references route_subscriptions (id) on delete cascade,
  listing_id uuid not null references listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (subscription_id, listing_id)
);

create index subscription_matches_subscription_idx on subscription_matches (subscription_id);

alter table subscription_matches enable row level security;

-- Основной запрос продукта (лента/поиск по маршруту) — составной индекс
-- по маршруту и дате, как того явно требуют техдетали эпика.
create index listings_route_date_idx on listings (from_city_id, to_city_id, date_from);
