-- E07 (полная модель вместо демо-среза 20260830120000_listings.sql):
-- реальные поля рейса и заявки, деньги и вес целыми числами в минимальных
-- единицах (ТЗ E01 п.1.12), вместо decimal-"кг"/"рублей" демо-среза.
--
-- Не входит в этот проход: ИИ-модерация объявления и вырезание контактов
-- (ТЗ 7.11-7.14) — это E13, а сценарий модерации там ещё не написан (есть
-- только разбор свободного текста). До него объявление публикуется сразу,
-- как и раньше. Статусы on_moderation/removed_by_moderator в схеме уже
-- есть, чтобы не делать вторую миграцию, когда модерация появится.
--
-- Одна таблица на оба типа, а не trips/parcel_requests, как буквально
-- названо в ТЗ: у демо-среза уже был работающий код вокруг общей таблицы
-- (лента, создание, редактирование на вебе) — расхождение полей рейса и
-- заявки решается набором nullable-колонок, это дешевле, чем разводить
-- два независимых API и склеивающий их запрос в ленте.
--
-- Существующие тестовые объявления из демо-среза не переносятся (их 1-2,
-- все — ручные проверки в деве): пересоздать проще, чем писать миграцию
-- пересчёта decimal-"кг"/"рублей" в граммы и копейки для пары строк.
drop table if exists listings;

create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('trip', 'request')),
  status text not null default 'published'
    check (
      status in ('draft', 'on_moderation', 'published', 'hidden_by_author', 'archived', 'removed_by_moderator')
    ),

  from_city_id uuid not null references cities (id),
  to_city_id uuid not null references cities (id),
  currency_id uuid not null references currencies (id),

  -- Рейс: даты вылета/прилёта. Заявка: желаемый диапазон "с"/"по" (E07 п.7.1, 7.5).
  date_from date not null,
  date_to date not null,
  check (date_to >= date_from),

  -- Рейс: свободный вес. Заявка: вес посылки. Кратно 500 г (п.7.24) —
  -- округляет клиент перед отправкой, здесь только защита от порчи данных.
  weight_grams integer not null check (weight_grams > 0 and weight_grams % 500 = 0),

  -- Рейс — оба обязательны (проверяется в DTO, не здесь). Заявка — оба
  -- необязательны и взаимоисключающи с price_total_minor.
  price_per_kg_minor integer check (price_per_kg_minor is null or price_per_kg_minor >= 0),
  min_price_minor integer check (min_price_minor is null or min_price_minor >= 0),
  -- Заявка: цена общей суммой вместо ставки за кг (п.7.5) — только один из
  -- двух способов цены задаётся одновременно, проверяется в DTO.
  price_total_minor integer check (price_total_minor is null or price_total_minor >= 0),

  -- Рейс (оба обязательны, п.7.1): где и как передать/забрать в городах
  -- вылета/прилёта.
  pickup_instructions text,
  dropoff_instructions text,
  -- Рейс: срок хранения посылки курьером — по умолчанию date_to + 7 дней,
  -- считается в приложении при создании (зависит от даты, не константа).
  storage_until_date date,
  -- Рейс: необязательные детали рейса, не участвуют в поиске.
  departure_airport text,
  arrival_airport text,
  flight_number text,

  -- Заявка (обязательно, п.7.5): краткое публичное описание груза — не
  -- опись содержимого, та только внутри сделки (E10).
  item_description text,

  -- Оба типа: необязательный комментарий.
  comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_from_city_idx on listings (from_city_id);
create index listings_to_city_idx on listings (to_city_id);
create index listings_owner_idx on listings (owner_id);
create index listings_created_at_idx on listings (created_at desc);
-- Лента (E08) и фоновая архивация (п.7.17) читают по статусу/типу/датам —
-- основной запрос продукта.
create index listings_status_dates_idx on listings (status, type, date_from, date_to);

create trigger set_listings_updated_at
  before update on listings
  for each row execute function set_updated_at();

-- RLS включена без разрешающих политик — как и остальные таблицы: доступ
-- только через бэкенд на service-ключе, не напрямую с клиента.
alter table listings enable row level security;
