-- Журнал обращений к ИИ-сервису (E13 п. 13.7): единая точка учёта для всех
-- сценариев AiService. Содержимое запроса/ответа не хранится — только
-- метаданные, нужные для отладки сбоев и учёта расходов (13.8).

create table ai_requests (
  id uuid primary key default gen_random_uuid(),
  scenario text not null
    check (scenario in ('listing_moderation', 'inventory_moderation', 'parse_listing_text', 'support_assistant')),
  -- Сущность, к которой относится вызов (объявление, опись, обращение) —
  -- необязательно: у сценария 3 (разбор текста) на момент вызова сущности
  -- ещё не существует, объявление не создано.
  entity_type text,
  entity_id uuid,
  actor_id uuid references users (id),
  request_length integer not null,
  response_length integer,
  verdict text,
  duration_ms integer not null,
  input_tokens integer,
  output_tokens integer,
  is_error boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index ai_requests_scenario_idx on ai_requests (scenario, created_at);
create index ai_requests_actor_idx on ai_requests (actor_id);

alter table ai_requests enable row level security;
