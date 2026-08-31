"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSupportQueue, type SupportTicket } from "@/lib/admin-support";

const STATUS_LABEL: Record<SupportTicket["status"], string> = {
  awaiting_moderator: "Ожидает ответа",
  in_progress: "В работе",
  closed: "Закрыто",
};

/** ТЗ E16 п.16.24 — очередь обращений с фильтром по статусу. */
export default function SupportQueuePage() {
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);

  useEffect(() => {
    fetchSupportQueue()
      .then(setTickets)
      .catch(() => setTickets([]));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Обращения в поддержку</h1>
        <Link href="/support/faq" className="text-sm text-[var(--color-primary)] hover:underline">
          База типовых ответов
        </Link>
      </div>

      {tickets === null ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Открытых обращений нет</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/support/${ticket.id}`}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-sm)] hover:border-[var(--color-primary)]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                  {STATUS_LABEL[ticket.status]}
                </span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {new Date(ticket.createdAt).toLocaleString("ru-RU")}
                </span>
              </div>
              <p className="mt-2 text-sm">
                {ticket.linkedObjectType ? `Привязано: ${ticket.linkedObjectType}` : "Без привязки"}
                {ticket.context.lastError ? ` · последняя ошибка: ${ticket.context.lastError}` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
