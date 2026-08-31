"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import {
  fetchNotifications,
  markNotificationRead,
  type Notification,
} from "@/lib/notifications";

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function NotificationCard({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (n: Notification) => void;
}) {
  const isUnread = notification.readAt === null;
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`block w-full rounded-md border p-4 text-left shadow-sm transition-colors ${
        isUnread ? "border-primary/40 bg-card" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading text-sm font-bold text-card-foreground">{notification.title}</p>
        {isUnread ? <span className="mt-1 size-2 shrink-0 rounded-full bg-action" /> : null}
      </div>
      <p className="mt-1.5 text-sm text-foreground">{notification.body}</p>
      <p className="mt-2 text-xs text-muted-foreground">{timeFormatter.format(new Date(notification.createdAt))}</p>
    </button>
  );
}

/** ТЗ E14 п.14.21 — список уведомлений в приложении с отметкой прочтения. */
export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);

  async function handleOpen(notification: Notification) {
    if (notification.readAt === null) {
      await markNotificationRead(notification.id).catch(() => null);
      setNotifications((prev) =>
        prev?.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)) ?? null,
      );
    }
    router.push(notification.deepLink);
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-foreground">{dictionary.notifications.title}</h1>
        <Link href="/notifications/settings" className="text-sm text-muted-foreground hover:text-foreground">
          {dictionary.notifications.settingsLink}
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {notifications === null ? (
          <p className="text-sm text-muted-foreground">{dictionary.notifications.loading}</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dictionary.notifications.empty}</p>
        ) : (
          notifications.map((n) => <NotificationCard key={n.id} notification={n} onOpen={handleOpen} />)
        )}
      </div>
    </div>
  );
}
