-- E10 (сделка) — семь статусов, опись, вес, контакты, фото передачи,
-- продление хранения. Как и в чате (E09), RLS включён без политик:
-- вся авторизация — в NestJS (deals.controller.ts), не в базе (E01).
--
-- Отложено сознательно (см. отчёт по эпику):
--   * "Купи и привези" как второй deal_type — только зарезервировано полем
--     (ТЗ п.10.44), логики под него нет.
--   * Модераторский доступ к проблемным сделкам с аудит-логом — ждёт E12/E16;
--     needs_review и status='problem' уже пишутся, дальше очередь не ведёт.
--   * Настоящая разбивка по часовым поясам городов в автопереходах (тех.
--     детали эпика) — как и в архивации объявлений (ТЗ E07), используется
--     сравнение по UTC-дате, а не по локальному времени города.

create table deals (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats (id) on delete cascade,
  listing_id uuid not null references listings (id) on delete cascade,
  customer_id uuid not null references users (id) on delete cascade,
  courier_id uuid not null references users (id) on delete cascade,
  deal_type text not null default 'delivery' check (deal_type = 'delivery'),
  status text not null default 'responded' check (
    status in (
      'responded', 'agreed', 'handed_over', 'in_transit',
      'awaiting_pickup', 'delivered', 'completed', 'cancelled', 'problem'
    )
  ),
  -- Заявленный вес (заказчик, при согласовании) и фактический (при
  -- передаче, необязательно) — ТЗ п.10.14. Оплачиваемый вес не хранится
  -- отдельной колонкой, считается как greatest() на чтении (10.15).
  declared_weight_grams integer check (declared_weight_grams is null or declared_weight_grams % 500 = 0),
  actual_weight_grams integer check (actual_weight_grams is null or actual_weight_grams % 500 = 0),
  -- Сколько именно веса удержано из listings.weight_grams — нужно, чтобы
  -- вернуть ровно столько же (не пересчитывая заново) при отмене/облегчении.
  reserved_weight_grams integer,
  -- Цена сделки хранится отдельно от цены объявления (ТЗ п.10.7) и может
  -- отличаться от тарифа объявления по договорённости (10.6).
  price_minor integer,
  currency_id uuid not null references currencies (id),
  -- Копия срока хранения объявления на момент agreed (10.30) — своя у
  -- каждой сделки, продление одной не должно задевать другие (10.42/10.32).
  storage_until_date date,
  customer_agreed_at timestamptz,
  courier_agreed_at timestamptz,
  courier_handed_over_at timestamptz,
  customer_handed_over_confirmed_at timestamptz,
  cancel_reason text,
  cancel_comment text,
  -- 13.20: сбой ИИ-проверки описи не блокирует сделку, но помечает её для
  -- ручного просмотра модератором (очередь появится вместе с E12/E16).
  needs_review boolean not null default false,
  reminder_3d_sent boolean not null default false,
  reminder_1d_sent boolean not null default false,
  reminder_expiry_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_chat_idx on deals (chat_id);
create index deals_listing_idx on deals (listing_id);
create index deals_customer_idx on deals (customer_id);
create index deals_courier_idx on deals (courier_id);
create index deals_status_idx on deals (status);

create trigger set_deals_updated_at
  before update on deals
  for each row execute function set_updated_at();

-- Опись содержимого (ТЗ п.10.10-10.13). Видна только участникам и
-- модератору — контроллер никогда не отдаёт её в публичных ответах
-- (deals.controller.ts, findById не включает items для чужих запросов).
create table deal_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  weight_grams integer,
  -- Предупреждение уровня "повод проверить" от ИИ (13.18) — жёсткий запрет
  -- из стоп-листа проверяется в коде до вставки и вообще не долетает сюда
  -- (позицию просто нельзя сохранить, ТЗ п.10.11).
  warning_text text,
  ai_check_failed boolean not null default false,
  created_at timestamptz not null default now()
);

create index deal_items_deal_idx on deal_items (deal_id);

-- Фотографии передачи (ТЗ п.10.26-10.29) — приватный бакет, ссылки временные.
create table deal_photos (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index deal_photos_deal_idx on deal_photos (deal_id);

-- Четыре необязательных контакта (ТЗ п.10.22-10.25): по одному на роль на
-- каждое из двух событий. Видны только участникам сделки, никогда — в
-- профиле или на публичных карточках.
create table deal_contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  event text not null check (event in ('handover', 'pickup')),
  role text not null check (role in ('customer', 'courier')),
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, event, role)
);

create trigger set_deal_contacts_updated_at
  before update on deal_contacts
  for each row execute function set_updated_at();

-- Журнал переходов (ТЗ п.10.2) — кто, когда, откуда куда, с каким
-- комментарием. actor_id = null означает автоматический переход (10.13).
create table deal_status_log (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references users (id) on delete set null,
  comment text,
  created_at timestamptz not null default now()
);

create index deal_status_log_deal_idx on deal_status_log (deal_id);

-- Согласие со стоп-листом и подтверждение ознакомления с предупреждением
-- ИИ (ТЗ п.10.13, 13.19) — раздельно по типу и по пользователю.
create table deal_consents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  consent_type text not null check (consent_type in ('stop_list', 'item_warning')),
  -- Снимок состояния стоп-листа на момент согласия (10.13) — максимум
  -- updated_at среди активных позиций на тот момент, а не номер версии:
  -- у справочника (E05) нет отдельного счётчика версий.
  stop_list_version timestamptz,
  consented_at timestamptz not null default now(),
  unique (deal_id, user_id, consent_type)
);

create index deal_consents_deal_idx on deal_consents (deal_id);

-- Продление хранения (ТЗ п.10.32) — запрашивает заказчик, решает курьер,
-- автопродления нет никогда.
create table storage_extension_requests (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  requested_by uuid not null references users (id) on delete cascade,
  requested_until_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index storage_extension_requests_deal_idx on storage_extension_requests (deal_id);

alter table deals enable row level security;
alter table deal_items enable row level security;
alter table deal_photos enable row level security;
alter table deal_contacts enable row level security;
alter table deal_status_log enable row level security;
alter table deal_consents enable row level security;
alter table storage_extension_requests enable row level security;

-- Приватный бакет для фотографий передачи (ТЗ п.10.28, "технические детали") —
-- хранятся бессрочно, пока существует сделка, доступ по временным ссылкам.
insert into storage.buckets (id, name, public, file_size_limit)
values ('deal-photos', 'deal-photos', false, 8388608)
on conflict (id) do nothing;
