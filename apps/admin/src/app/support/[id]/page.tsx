"use client";

import { use, useEffect, useState } from "react";
import {
  SUPPORT_ACCOUNT_ID,
  claimSupportTicket,
  closeSupportTicket,
  fetchSupportMessages,
  fetchSupportTicket,
  sendSupportReply,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/admin-support";

const POLL_INTERVAL_MS = 5_000;

/**
 * ТЗ E16 пп.16.13-16.14, 16.25 — карточка обращения с полным
 * автоматически собранным контекстом и переписка с пользователем прямо
 * отсюда.
 */
export default function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchSupportTicket(id)
      .then(setTicket)
      .catch(() => setTicket(null));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const poll = () => fetchSupportMessages(id).then((m) => !cancelled && setMessages(m));
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  async function handleSend() {
    if (body.trim().length === 0) return;
    setIsSending(true);
    try {
      const sent = await sendSupportReply(id, body.trim());
      setMessages((prev) => [...prev, sent]);
      setBody("");
    } finally {
      setIsSending(false);
    }
  }

  if (ticket === null) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Обращение</h1>
        <div className="flex gap-2">
          {ticket.status !== "closed" ? (
            <>
              <button
                type="button"
                onClick={() => claimSupportTicket(id).then(setTicket)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
              >
                Взять в работу
              </button>
              <button
                type="button"
                onClick={() => closeSupportTicket(id).then(setTicket)}
                className="rounded-[var(--radius-sm)] bg-[var(--color-destructive)] px-3 py-1.5 text-sm font-semibold text-[var(--color-on-destructive)]"
              >
                Закрыть
              </button>
            </>
          ) : (
            <span className="text-sm text-[var(--color-muted-foreground)]">Закрыто</span>
          )}
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Автоматически собранный контекст</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-[var(--color-muted-foreground)]">Верификация</dt>
          <dd>{ticket.context.verificationStatus}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Всего сделок</dt>
          <dd>{ticket.context.totalDealsCount}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Активные сделки</dt>
          <dd>{ticket.context.activeDealIds.length}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Платформа</dt>
          <dd>{ticket.context.platform ?? "—"}</dd>
          {ticket.context.lastError ? (
            <>
              <dt className="text-[var(--color-muted-foreground)]">Последняя ошибка</dt>
              <dd className="text-[var(--color-destructive)]">{ticket.context.lastError}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {messages.map((message) => {
            if (message.kind === "system") {
              return (
                <p key={message.id} className="text-center text-xs text-[var(--color-muted-foreground)]">
                  {message.body}
                </p>
              );
            }
            const isFromSupport = message.senderId === SUPPORT_ACCOUNT_ID;
            return (
              <div key={message.id} className={`flex ${isFromSupport ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-[var(--radius-sm)] px-3 py-2 text-sm ${
                    isFromSupport ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-muted)]"
                  }`}
                >
                  {message.body}
                </div>
              </div>
            );
          })}
        </div>

        {ticket.status !== "closed" ? (
          <div className="flex gap-2 border-t border-[var(--color-border)] pt-3">
            <textarea
              rows={1}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ответ пользователю…"
              className="flex-1 resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || body.trim().length === 0}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
            >
              Отправить
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
