import { z } from "zod";

/**
 * Схема переменных окружения. SUPABASE_* обязательны с этапа E01.3 —
 * до подключения реального проекта Supabase для локальной разработки
 * достаточно синтаксически корректных значений-заглушек в .env.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["local", "staging", "production"]).default("local"),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  // Прямое подключение к Postgres — нужно слою репозиториев для настоящих
  // транзакций (PostgREST/anon/service-ключи их не дают, см. E01 п. 1.16).
  SUPABASE_DB_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Валидируется один раз при старте (см. ConfigModule.forRoot({ validate })).
 * Некорректная или неполная конфигурация должна остановить процесс
 * с понятным сообщением, а не уронить приложение позже в случайном месте.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(корень)"}: ${issue.message}`)
      .join("\n");

    // eslint-disable-next-line no-console
    console.error(
      `Некорректная конфигурация окружения. Проверьте .env (см. .env.example):\n${issues}`,
    );
    process.exit(1);
  }

  return result.data;
}
