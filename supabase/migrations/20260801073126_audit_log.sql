-- Журнал действий модераторов (E01 п. 1.13). Append-only: строки никогда
-- не редактируются и не удаляются, поэтому updated_at здесь не нужен —
-- он подразумевал бы, что запись можно менять, а это не так.
--
-- actor_id пока без внешнего ключа: таблица admin_users появится в E16.
-- Ссылку добавим отдельной миграцией, когда admin_users будет существовать.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id);
create index audit_log_actor_idx on audit_log (actor_id);
create index audit_log_created_at_idx on audit_log (created_at desc);
