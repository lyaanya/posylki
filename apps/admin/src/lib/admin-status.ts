"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminApiError, apiGet } from "./api";
import { useSession } from "./auth";

export type AdminAccessStatus =
  | { state: "loading" }
  | { state: "signedOut" }
  | { state: "notAnAdmin" }
  | { state: "needs2fa" }
  | { state: "ready" };

/**
 * Три уровня допуска (ТЗ E16 п.16.1-16.3): обычный пользователь не
 * пройдёт даже AdminIdentityGuard; сотрудник без пройденной 2FA пройдёт
 * его, но не AdminGuard; полностью вошедший сотрудник проходит оба.
 * /admin/auth/totp/status использует более слабый guard специально для
 * этой проверки — see apps/api/src/admin/admin-identity.guard.ts.
 */
export function useAdminAccessStatus(): AdminAccessStatus {
  const session = useSession();
  // Смена сессии Supabase не отличает "вошёл паролем" от "прошёл 2FA" —
  // оба состояния используют одну и ту же сессию. Без pathname в
  // зависимостях переход /totp → / после успешной проверки кода не
  // перепроверял бы статус заново, и гейт откатывал бы обратно на /totp
  // со старым (ещё not-ready) результатом.
  const pathname = usePathname();
  const [status, setStatus] = useState<AdminAccessStatus>({ state: "loading" });

  useEffect(() => {
    if (session.status === "loading") {
      setStatus({ state: "loading" });
      return;
    }
    if (session.status === "signedOut") {
      setStatus({ state: "signedOut" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await apiGet("/admin/auth/totp/status");
      } catch (err) {
        if (!cancelled) setStatus({ state: err instanceof AdminApiError && err.code === "FORBIDDEN" ? "notAnAdmin" : "signedOut" });
        return;
      }

      try {
        await apiGet("/admin/summary");
        if (!cancelled) setStatus({ state: "ready" });
      } catch {
        if (!cancelled) setStatus({ state: "needs2fa" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.status, pathname]);

  return status;
}
