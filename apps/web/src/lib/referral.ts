const STORAGE_KEY = "vezzy-pending-referrer";

/**
 * ТЗ E08 п.8.17 — переход по ссылке-приглашению запоминает, кто кого
 * привёл. Ссылка ведёт на любую страницу с ?ref=<id>; сохраняем в
 * localStorage до момента входа/регистрации, когда есть кому это записать
 * (см. profile.ts, setReferral — сама запись идёт через бэкенд и требует сессию).
 */
export function rememberReferrerFromUrl(): void {
  if (typeof window === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref) return;
  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, ref);
    }
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — не критично,
    // просто не запомним пригласившего.
  }
}

export function getPendingReferrerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferrer(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // см. rememberReferrerFromUrl
  }
}

export function referralLink(userId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/?ref=${userId}`;
}
