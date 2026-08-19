-- Найдено официальным security/performance advisor'ом Supabase после
-- аудита разработки. Три независимых, дешёвых фикса.

-- 1. search_path не был зафиксирован — в принципе позволяет перехватить
--    вызов функции объектом с тем же именем в другой схеме, если она
--    окажется раньше в search_path вызывающей роли.
alter function set_updated_at() set search_path = public;

-- 2. handle_new_auth_user() — триггерная функция, не предназначена для
--    прямого вызова. Как SECURITY DEFINER она была доступна как обычный
--    RPC-эндпоинт (/rest/v1/rpc/handle_new_auth_user) анонимным и
--    авторизованным пользователям. Триггеру EXECUTE не нужен — он
--    сработает и без грантов, они нужны только для прямых вызовов.
revoke execute on function handle_new_auth_user() from public, anon, authenticated;

-- 3. Внешние ключи на admin_id без индекса — дёшево закрыть сразу,
--    пригодится, когда появится админ-панель (E16).
create index legal_consents_legal_document_id_idx on legal_consents (legal_document_id);
create index users_verified_by_admin_id_idx on users (verified_by_admin_id);
create index verification_requests_reviewed_by_admin_id_idx on verification_requests (reviewed_by_admin_id);
