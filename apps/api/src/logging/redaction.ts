/**
 * Известные имена ключей, где могут оказаться секреты (E01 п. 1.23).
 * Значения по этим путям заменяются на censor вместо реального значения,
 * даже если кто-то залогирует целый объект, содержащий такое поле.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.apiKey",
  "*.secret",
  "*.serviceKey",
  "*.SUPABASE_SERVICE_KEY",
  "*.SUPABASE_ANON_KEY",
  "*.SUPABASE_DB_URL",
];

export const REDACT_CENSOR = "[Redacted]";
