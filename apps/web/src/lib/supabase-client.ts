import { createClient } from "@supabase/supabase-js";

/**
 * Единственное место в проекте, где веб-клиент обращается к Supabase
 * напрямую, а не через наш API: сама авторизация — забота Supabase Auth
 * (см. E03), а не нашего бэкенда. Всё остальное (объявления, чаты, сделки)
 * идёт через REST API, как и решено в архитектуре.
 *
 * Сессия хранится в localStorage браузера — этого достаточно, пока
 * приложение целиком клиентское (без серверных компонентов, читающих
 * сессию). Переход на @supabase/ssr с cookie понадобится, когда появится
 * серверная логика, которой нужно знать, кто вошёл, до рендера на клиенте.
 */
export function createSupabaseBrowserClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
  );
}
