const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 60_000;

/**
 * ТЗ п.14.18 — до трёх повторов с нарастающим интервалом. retryCount —
 * сколько попыток уже было (0 при первом сбое). Возвращает задержку до
 * следующей попытки или null, если попытки исчерпаны и уведомление
 * считается недоставленным (retryCount ≥ 3 попыток).
 */
export function nextRetryDelayMs(retryCount: number): number | null {
  if (retryCount >= MAX_ATTEMPTS) return null;
  return BASE_DELAY_MS * 2 ** retryCount;
}
