"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import {
  SUPPORT_ACCOUNT_ID,
  createOrContinueTicket,
  fetchTicketMessages,
  sendTicketMessage,
  type CreateSupportTicketInput,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/support";

const POLL_INTERVAL_MS = 5_000;

const STATUS_LABEL: Record<SupportTicket["status"], string> = {
  awaiting_moderator: dictionary.support.statusAwaiting,
  in_progress: dictionary.support.statusInProgress,
  closed: dictionary.support.statusClosed,
};

/**
 * ТЗ E15 — обращение в поддержку поверх чата E09. Доступна и заблокированному
 * пользователю (см. AccountStatusGate.tsx — эта страница явно исключена
 * из полноэкранной блокировки, иначе оспорить её будет неоткуда).
 * ИИ-ассистент (15.7-15.14) не подключён (nice-to-have, отложено — см.
 * отчёт эпика): все сообщения читает и на все отвечает только модератор.
 */
export default function SupportPage() {
  const searchParams = useSearchParams();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [bodyInput, setBodyInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dealId = searchParams.get("dealId");
    const listingId = searchParams.get("listingId");
    const linkedObject: CreateSupportTicketInput = dealId
      ? { linkedObjectType: "deal", linkedObjectId: dealId }
      : listingId
        ? { linkedObjectType: "listing", linkedObjectId: listingId }
        : {};

    createOrContinueTicket(linkedObject)
      .then((created) => {
        setTicket(created);
        setError(null);
      })
      .catch(() => setError(dictionary.support.genericError));
  }, [searchParams]);

  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;

    const poll = () => {
      fetchTicketMessages(ticket.id).then((items) => {
        if (!cancelled) setMessages(items);
      });
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ticket]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const body = bodyInput.trim();
    if (!body || !ticket) return;
    setIsSending(true);
    setError(null);
    try {
      const sent = await sendTicketMessage(ticket.id, body);
      setMessages((prev) => [...prev, sent]);
      setBodyInput("");
    } catch {
      setError(dictionary.support.sendError);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col py-6 md:h-[calc(100dvh-6rem)]">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h1 className="font-heading text-lg font-bold text-foreground">{dictionary.support.title}</h1>
        {ticket ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {STATUS_LABEL[ticket.status]}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {!ticket ? (
          <p className="text-sm text-muted-foreground">{dictionary.support.loading}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dictionary.support.empty}</p>
        ) : (
          messages.map((message) => {
            if (message.kind === "system") {
              return (
                <p key={message.id} className="text-center text-xs text-muted-foreground">
                  {message.body}
                </p>
              );
            }
            const isFromSupport = message.senderId === SUPPORT_ACCOUNT_ID;
            return (
              <div key={message.id} className={`flex ${isFromSupport ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-md px-3.5 py-2.5 text-sm shadow-sm ${
                    isFromSupport ? "bg-card text-card-foreground" : "bg-action text-on-action"
                  }`}
                >
                  {isFromSupport ? (
                    <p className="mb-1 text-xs font-bold opacity-70">{dictionary.support.supportSenderLabel}</p>
                  ) : null}
                  {message.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}

      <div className="flex items-end gap-2 border-t border-border pt-3">
        <textarea
          rows={1}
          value={bodyInput}
          onChange={(e) => setBodyInput(e.target.value)}
          placeholder={dictionary.support.messagePlaceholder}
          maxLength={4000}
          className="min-h-10 flex-1 resize-none rounded-md border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !ticket || bodyInput.trim().length === 0}
          className="font-heading h-10 shrink-0 rounded-sm bg-action px-4 text-sm font-bold text-on-action disabled:opacity-50"
        >
          {isSending ? dictionary.support.sending : dictionary.support.sendCta}
        </button>
      </div>
    </div>
  );
}
