const formatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

/**
 * Строка вида "2026-09-15" → "15 сентября". Дата собирается из компонентов
 * напрямую (не new Date(isoString)), чтобы избежать сдвига на день —
 * та же ловушка часового пояса, что и на бэкенде (см. listings.repository).
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  return formatter.format(new Date(year, month - 1, day));
}
