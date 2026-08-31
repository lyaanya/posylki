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

  // --- ИИ-сервис (E13) ---
  // Необязателен, в отличие от остальных ключей: недоступность ИИ-сервиса
  // никогда не должна останавливать продукт (E13 п. 13.6) — в том числе
  // на этапе, когда ключ ещё не заведён. AiService без ключа ведёт себя
  // как при сбое сценария, а не роняет приложение при старте.
  GROQ_API_KEY: z.string().min(1).optional(),
  // gpt-oss-120b — открытая модель OpenAI, бесплатно через Groq. Идентификатор
  // вынесен в переменную окружения (E13 п. 13.2) — смена модели без правки кода.
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),

  // --- Верификация (E04 п. 4.18) ---
  // Общая для инсталляции соль для хэша номера документа — обязательна
  // (в отличие от опциональных ключей выше), потому что без неё хэш
  // тривиально перебираем по утёкшей базе. Сгенерировать: `openssl rand
  // -hex 32`. Смена значения "потеряет" все прежние хэши — сравнение с
  // уже одобренными заявками перестанет находить совпадения.
  DOCUMENT_HASH_SALT: z.string().min(32),

  // --- Уведомления (E14) ---
  // Все три — заявки на доступ, которые ещё не оформлены (нужен Apple
  // Developer сертификат, проект Firebase, аккаунт в почтовом сервисе,
  // токен Telegram-бота — см. отчёт эпика). Каналы ведут себя как ИИ-сервис
  // без ключа: недоступность канала логируется, но не роняет приложение и
  // не блокирует основной сценарий (14.17).
  APNS_KEY: z.string().min(1).optional(),
  FCM_SERVER_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  // Адрес отправителя должен принадлежать домену, для которого в Resend
  // настроены SPF/DKIM/DMARC — иначе письма уйдут в спам даже с рабочим
  // ключом. Формат: "Посылки <notifications@example.com>".
  NOTIFICATIONS_EMAIL_FROM: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
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

    console.error(
      `Некорректная конфигурация окружения. Проверьте .env (см. .env.example):\n${issues}`,
    );
    process.exit(1);
  }

  return result.data;
}
