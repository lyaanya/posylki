"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth";
import { dictionary } from "@/lib/dictionary";
import {
  acknowledgeWarning,
  checkAccountStatus,
  fetchPendingWarning,
  type UserWarning,
} from "@/lib/moderation";

/**
 * Смонтирован в layout.tsx рядом с Header — единственное место, которое
 * знает и про непрочитанные предупреждения (ТЗ п.12.12, блокирующая
 * модалка до подтверждения, но без ограничения доступа), и про
 * заблокированный аккаунт (п.12.15 — полноэкранный статус вместо
 * содержимого приложения). Оба состояния проверяются только у вошедших
 * пользователей и только один раз за сессию логина.
 */
export function AccountStatusGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  // ТЗ E15 п.15.6 — поддержка остаётся доступна заблокированному
  // пользователю: иначе оспорить блокировку неоткуда.
  const isSupportRoute = pathname?.startsWith("/support") ?? false;
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [warning, setWarning] = useState<UserWarning | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (session.status !== "signedIn") {
      setBlockedReason(null);
      setWarning(null);
      setChecked(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const status = await checkAccountStatus();
      if (cancelled) return;
      if (status.blocked) {
        setBlockedReason(status.reason);
        setChecked(true);
        return;
      }
      const pending = await fetchPendingWarning();
      if (cancelled) return;
      setWarning(pending);
      setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [session.status]);

  async function handleAcknowledge() {
    if (!warning) return;
    await acknowledgeWarning(warning.id).catch(() => null);
    setWarning(null);
  }

  if (session.status === "signedIn" && checked && blockedReason !== null && !isSupportRoute) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 text-center shadow-sm">
          <p className="font-heading text-lg font-bold text-foreground">
            {dictionary.moderation.blockedTitle}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {dictionary.moderation.blockedTextPrefix} {blockedReason}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">{dictionary.moderation.blockedFooter}</p>
          <Link
            href="/support"
            className="font-heading mt-5 block w-full rounded-sm bg-action py-2.5 text-sm font-bold text-on-action"
          >
            {dictionary.support.cta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {warning ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-lg bg-card p-5 shadow-lg sm:rounded-md">
            <p className="font-heading text-lg font-bold text-foreground">
              {dictionary.moderation.warningModalTitle}
            </p>
            <p className="mt-2 text-sm text-foreground">{warning.reason}</p>
            <button
              type="button"
              onClick={handleAcknowledge}
              className="font-heading mt-5 w-full rounded-sm bg-action py-2.5 text-sm font-bold text-on-action"
            >
              {dictionary.moderation.warningAcknowledgeCta}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
