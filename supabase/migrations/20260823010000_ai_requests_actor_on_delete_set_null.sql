-- Найдено при ручной проверке (E13): удаление пользователя блокировалось
-- внешним ключом ai_requests.actor_id без ON DELETE — по умолчанию RESTRICT.
-- ai_requests — журнал учёта расходов (13.7), а не история, привязанная
-- к живому пользователю: удаление аккаунта (E03 п. 3.22 — обезличивание,
-- а не блокировка) не должно от него зависеть. Строка лога остаётся для
-- учёта, актор обнуляется.

alter table ai_requests
  drop constraint ai_requests_actor_id_fkey;

alter table ai_requests
  add constraint ai_requests_actor_id_fkey
  foreign key (actor_id) references users (id) on delete set null;
