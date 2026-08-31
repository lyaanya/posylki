"use client";

import { useEffect, useState } from "react";
import { useSession } from "./auth";
import { fetchUnreadCount } from "./chat";

const POLL_INTERVAL_MS = 15_000;

/**
 * Опрос вместо Supabase Realtime (см. комментарий в миграции чата) —
 * общий счётчик для Header и BottomNav.
 */
export function useUnreadChatCount(): number {
  const session = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (session.status !== "signedIn") {
      setCount(0);
      return;
    }

    let cancelled = false;
    const poll = () => {
      fetchUnreadCount()
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          // Транзиентный сбой опроса (истёкшая сессия, сеть) — тихо
          // пропускаем цикл вместо необработанного отказа промиса.
        });
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session.status]);

  return count;
}
