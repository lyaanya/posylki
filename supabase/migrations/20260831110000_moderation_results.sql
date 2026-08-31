-- E13 (ИИ-сервис) — очередь ручного просмотра для сценариев 1 и 2
-- («модерация объявления», «модерация описи»). ai_requests уже логирует
-- каждый вызов модели для отладки и учёта расходов (13.7/13.8), но хранит
-- только короткий verdict-строку без категории/пояснения/контактов —
-- этого достаточно для стоимости, но не для того, чтобы модератор мог
-- разобрать конкретный случай. moderation_results — более узкая, богатая
-- по содержанию таблица: одна строка на решение, которое требует или может
-- потребовать взгляда человека (verdict 'flag'/'reject', либо сбой
-- сценария — 13.14/13.20). Чистые 'pass' сюда не попадают, чтобы очередь
-- оставалась очередью, а не полным дублем ai_requests.
--
-- entity_id — без FK, по тому же принципу полиморфной цели, что и
-- complaints.target_id/audit_log.entity_id: сценарий 1 указывает на
-- listings, сценарий 2 — на deals.
create table moderation_results (
  id uuid primary key default gen_random_uuid(),
  scenario text not null check (scenario in ('listing_moderation', 'inventory_moderation')),
  entity_type text not null,
  entity_id uuid not null,
  verdict text not null check (verdict in ('flag', 'reject')),
  category text,
  explanation text,
  contacts_found text[] not null default '{}',
  reviewed_at timestamptz,
  reviewed_by uuid references admin_users (id),
  created_at timestamptz not null default now()
);

create index moderation_results_entity_idx on moderation_results (entity_type, entity_id);
create index moderation_results_pending_idx on moderation_results (created_at) where reviewed_at is null;

alter table moderation_results enable row level security;
