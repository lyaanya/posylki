-- Базовые соглашения о схеме (E01, п. 1.12), общие для всех последующих миграций.

-- gen_random_uuid() для первичных ключей всех таблиц.
create extension if not exists "pgcrypto";

-- Переиспользуемый триггер: у каждой пользовательской таблицы есть
-- created_at и updated_at, updated_at обновляется автоматически при UPDATE.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function set_updated_at() is
  'Общий триггер для колонки updated_at. Подключается через '
  'create trigger ... before update on <table> for each row execute function set_updated_at();';
