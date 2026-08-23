-- Справочники (E05): города, валюты, ориентировочные веса, стоп-лист,
-- типы документов. Все пять редактируются из админ-панели (E16, задача 5.6);
-- физическое удаление используемой записи запрещено — эта миграция создаёт
-- только структуру и предохранители на уровне схемы, проверка "используется
-- ли запись" перед отключением остаётся на уровне API (5.20).

-- === cities ================================================================
create table cities (
  id uuid primary key default gen_random_uuid(),
  name_ru text not null,
  name_en text not null,
  country_code text not null,
  timezone text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  -- Синонимы для поиска — альтернативные написания (Nha Trang, Камрань).
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cities_active_sort_idx on cities (is_active, sort_order);

create trigger set_cities_updated_at
  before update on cities
  for each row execute function set_updated_at();

-- === currencies =============================================================
create table currencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  symbol text not null,
  decimal_places smallint not null default 2,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_currencies_updated_at
  before update on currencies
  for each row execute function set_updated_at();

-- === weight_references =======================================================
create table weight_references (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  weight_grams integer not null,
  -- Верхняя граница диапазона (напр. «блистер таблеток, 20–50 г»), null — точный вес.
  weight_grams_max integer,
  category text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_references_range_check
    check (weight_grams_max is null or weight_grams_max >= weight_grams)
);

create trigger set_weight_references_updated_at
  before update on weight_references
  for each row execute function set_updated_at();

-- === stop_list_items =========================================================
create table stop_list_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  explanation text,
  category text,
  -- Пусто — правило действует во всех странах (E05 п. 5.13).
  country_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_stop_list_items_updated_at
  before update on stop_list_items
  for each row execute function set_updated_at();

-- === document_types ==========================================================
create table document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text not null,
  number_pattern text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_document_types_updated_at
  before update on document_types
  for each row execute function set_updated_at();

-- === Row Level Security ======================================================
-- Как и остальные таблицы (E01 п. 1.свод): читает и пишет только бэкенд
-- через service-ключ, RLS отсекает прямой доступ анонимного/пользовательского
-- ключа. Справочники всё равно публично читаемы, но только через наш API,
-- который умеет отдавать ETag/304 (5.22) и не отдаёт отключённые записи
-- за пределами уже существующих ссылок на них (5.3).
alter table cities enable row level security;
alter table currencies enable row level security;
alter table weight_references enable row level security;
alter table stop_list_items enable row level security;
alter table document_types enable row level security;

-- === начальное наполнение (E05 п. 5.4, 5.8, 5.12, 5.16, 5.19) ================

insert into cities (name_ru, name_en, country_code, timezone, sort_order, synonyms) values
  ('Нячанг', 'Nha Trang', 'VN', 'Asia/Ho_Chi_Minh', 1, array['Nha Trang', 'Камрань', 'Cam Ranh']),
  ('Дананг', 'Da Nang', 'VN', 'Asia/Ho_Chi_Minh', 2, array['Da Nang', 'Danang']),
  ('Хошимин', 'Ho Chi Minh', 'VN', 'Asia/Ho_Chi_Minh', 3, array['Ho Chi Minh', 'Сайгон', 'Saigon', 'HCMC']),
  ('Ханой', 'Hanoi', 'VN', 'Asia/Ho_Chi_Minh', 4, array['Hanoi', 'Ha Noi']),
  ('Муйне', 'Mui Ne', 'VN', 'Asia/Ho_Chi_Minh', 5, array['Mui Ne', 'Фантьет', 'Phan Thiet']),
  ('Москва', 'Moscow', 'RU', 'Europe/Moscow', 6, array['Moscow', 'Мск']),
  ('Санкт-Петербург', 'Saint Petersburg', 'RU', 'Europe/Moscow', 7, array['Saint Petersburg', 'СПб', 'Питер']),
  ('Новосибирск', 'Novosibirsk', 'RU', 'Asia/Novosibirsk', 8, array['Novosibirsk', 'Нск']),
  ('Красноярск', 'Krasnoyarsk', 'RU', 'Asia/Krasnoyarsk', 9, array['Krasnoyarsk']),
  ('Воронеж', 'Voronezh', 'RU', 'Europe/Moscow', 10, array['Voronezh']),
  ('Краснодар', 'Krasnodar', 'RU', 'Europe/Moscow', 11, array['Krasnodar']),
  ('Ростов-на-Дону', 'Rostov-on-Don', 'RU', 'Europe/Moscow', 12, array['Rostov-on-Don', 'Ростов']),
  ('Алматы', 'Almaty', 'KZ', 'Asia/Almaty', 13, array['Almaty', 'Алма-Ата']),
  ('Астана', 'Astana', 'KZ', 'Asia/Almaty', 14, array['Astana', 'Нур-Султан']),
  ('Бишкек', 'Bishkek', 'KG', 'Asia/Bishkek', 15, array['Bishkek']);

insert into currencies (code, name, symbol, decimal_places) values
  ('RUB', 'Российский рубль', '₽', 2),
  ('VND', 'Донг', '₫', 0),
  ('KGS', 'Сом', 'с', 2),
  ('KZT', 'Тенге', '₸', 2);

insert into weight_references (name, weight_grams, weight_grams_max, sort_order) values
  ('Лист А4', 5, null, 1),
  ('Пачка документов А4, 50 листов', 250, null, 2),
  ('Блистер таблеток в коробке', 20, 50, 3),
  ('Тюбик крема 50 мл', 80, null, 4),
  ('Флакон духов 50 мл', 200, null, 5),
  ('Тюбик зубной пасты', 150, null, 6),
  ('Книга в мягкой обложке', 300, null, 7),
  ('Книга в твёрдой обложке', 500, null, 8),
  ('Футболка', 150, null, 9),
  ('Джинсы', 600, null, 10),
  ('Кроссовки, пара', 800, null, 11),
  ('Смартфон в коробке', 400, null, 12),
  ('Ноутбук 13 дюймов', 1500, null, 13),
  ('Банка детской смеси 400 г', 500, null, 14),
  ('Плитка шоколада 100 г', 110, null, 15);

insert into stop_list_items (name, explanation) values
  ('Наркотические и психотропные вещества', 'Включая препараты, содержащие их в составе'),
  ('Рецептурные лекарственные препараты', 'Перевозка возможна только с рецептом на имя получателя и в пределах личной нормы'),
  ('Оружие, боеприпасы, их части и копии', 'Включая травматическое, пневматическое и сигнальное'),
  ('Взрывчатые и легковоспламеняющиеся вещества', 'Включая аэрозоли под давлением'),
  ('Литиевые аккумуляторы и павербанки сверх норм авиаперевозки', 'Ограничения устанавливает авиакомпания'),
  ('Ядовитые, едкие и радиоактивные вещества', null),
  ('Живые животные и растения, семена, почва', null),
  ('Скоропортящиеся продукты', null),
  ('Наличные деньги сверх декларируемых лимитов', 'Пересечение границы с наличными регулируется таможней'),
  ('Банковские карты и документы на чужое имя', 'Включая паспорта и доверенности'),
  ('Драгоценные металлы и камни', null),
  ('Электронные сигареты, вейпы и жидкости к ним', 'Во Вьетнаме запрещены к ввозу и обороту'),
  ('Алкоголь и табак сверх норм беспошлинного ввоза', 'Нормы устанавливает страна назначения'),
  ('Любые товары, запрещённые к ввозу в страну назначения', 'Общее правило');

insert into document_types (name, country_code) values
  ('Заграничный паспорт РФ', 'RU'),
  ('Внутренний паспорт РФ', 'RU'),
  ('Удостоверение личности Республики Казахстан', 'KZ'),
  ('Паспорт Республики Казахстан', 'KZ'),
  ('Паспорт Кыргызской Республики', 'KG'),
  ('ID-карта Кыргызской Республики', 'KG');
