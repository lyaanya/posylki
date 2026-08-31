const DEFAULT_TIMEZONE = "Europe/Moscow";
const QUIET_START_HOUR = 23;
const QUIET_END_HOUR = 8;

/**
 * ТЗ п.14.11 — часовой пояс из города профиля; запасной вариант "по
 * настройке устройства" здесь не реализован (сервер не получает такого
 * сигнала вне пуш-регистрации, которой в этой итерации не существует —
 * см. отчёт эпика), поэтому цепочка короче: город → Europe/Moscow.
 */
export function resolveTimezone(cityTimezone: string | null | undefined): string {
  return cityTimezone && cityTimezone.trim().length > 0 ? cityTimezone : DEFAULT_TIMEZONE;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getLocalParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts["year"]),
    month: Number(parts["month"]),
    day: Number(parts["day"]),
    // Некоторые реализации ICU отдают полночь как "24" при hour12:false.
    hour: Number(parts["hour"]) % 24,
    minute: Number(parts["minute"]),
    second: Number(parts["second"]),
  };
}

/** Стандартный приём для перевода "стенных часов" в конкретной зоне в UTC без библиотеки часовых поясов. */
function zonedWallTimeToUtc(parts: LocalParts, timeZone: string): Date {
  const guessUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const renderedBack = getLocalParts(new Date(guessUtcMs), timeZone);
  const renderedBackMs = Date.UTC(
    renderedBack.year,
    renderedBack.month - 1,
    renderedBack.day,
    renderedBack.hour,
    renderedBack.minute,
    renderedBack.second,
  );
  const driftMs = renderedBackMs - guessUtcMs;
  return new Date(guessUtcMs - driftMs);
}

/** ТЗ п.14.10 — 23:00-08:00 по местному времени пользователя. */
export function isQuietHours(date: Date, timeZone: string): boolean {
  const { hour } = getLocalParts(date, timeZone);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/**
 * ТЗ п.14.10/14.12 — срочное всегда сейчас; несрочное в тихие часы
 * переносится на 08:00 по местному времени (сегодня, если сейчас уже
 * после полуночи, иначе завтра).
 */
export function computeSendAfter(now: Date, timeZone: string, isUrgent: boolean): Date {
  if (isUrgent || !isQuietHours(now, timeZone)) {
    return now;
  }

  const local = getLocalParts(now, timeZone);
  const targetDay = local.hour >= QUIET_START_HOUR ? local.day + 1 : local.day;

  return zonedWallTimeToUtc(
    { year: local.year, month: local.month, day: targetDay, hour: QUIET_END_HOUR, minute: 0, second: 0 },
    timeZone,
  );
}
