"use client";

import { useEffect, useState } from "react";
import { useSession } from "./auth";
import { fetchUnreadNotificationCount } from "./notifications";

const POLL_INTERVAL_MS = 30_000;

/** Тот же принцип опроса, что и у чатов (см. use-unread-chats.ts) — общий счётчик для Header. */
export function useUnreadNotificationCount(): number {
  const session = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (session.status !== "signedIn") {
      setCount(0);
      return;
    }

    let cancelled = false;
    const poll = () => {
      fetchUnreadNotificationCount()
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
