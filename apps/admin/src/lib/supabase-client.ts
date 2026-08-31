import { createClient } from "@supabase/supabase-js";

/**
 * Тот же принцип, что и в apps/web/src/lib/supabase-client.ts: сама
 * аутентификация — прямой Supabase Auth, всё остальное идёт через наш
 * REST API. Отдельное приложение (ТЗ E16 п.16.1), но не отдельный
 * протокол входа — обычный пользователь просто не может попасть в
 * admin_users, а значит не пройдёт AdminGuard, даже войдя тем же способом.
 */
export function createSupabaseBrowserClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
  );
}
