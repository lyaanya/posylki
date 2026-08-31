"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import {
  ChatApiError,
  blockChatCounterpart,
  fetchMessages,
  fetchMyChats,
  markChatRead,
  sendMessageToChat,
  sendMessageToListing,
  unblockChatCounterpart,
  uploadChatAttachment,
  type ChatMessage,
  type ChatParticipant,
} from "@/lib/chat";
import { createDeal, fetchDealsByChat, type Deal } from "@/lib/deals";
import { Avatar } from "@/components/Avatar";
import { ComplaintButton } from "@/components/ComplaintButton";

const POLL_INTERVAL_MS = 5_000;
const MAX_ATTACHMENTS = 5;
const CONTACT_REMINDER_KEY = "vezzy-chat-contact-reminder-seen";

function hasSeenContactReminder(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(CONTACT_REMINDER_KEY) === "1";
  } catch {
    return true;
  }
}

function markContactReminderSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONTACT_REMINDER_KEY, "1");
  } catch {
    // приватный режим и т.п. — просто покажем баннер снова в следующий раз
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ChatApiError) {
    switch (error.code) {
      case "EMAIL_NOT_CONFIRMED":
        return dictionary.chat.emailNotConfirmedError;
      case "BLOCKED_BY_RECIPIENT":
        return dictionary.chat.blockedByRecipientError;
      case "EMPTY_MESSAGE":
        return dictionary.chat.emptyMessageError;
      default:
        return error.message || dictionary.chat.sendError;
    }
  }
  return dictionary.chat.sendError;
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

interface ChatThreadViewProps {
  /** null — чат ещё не создан, будет создан при первом сообщении. */
  chatId: string | null;
  listingId: string;
  counterpart: ChatParticipant;
  onChatCreated?: (chatId: string) => void;
}

export function ChatThreadView({ chatId, listingId, counterpart, onChatCreated }: ChatThreadViewProps) {
  const router = useRouter();
  const [activeChatId, setActiveChatId] = useState(chatId);
  const [chatDeals, setChatDeals] = useState<Deal[]>([]);
  const [isStartingDeal, setIsStartingDeal] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [showContactReminder, setShowContactReminder] = useState(false);
  const [bodyInput, setBodyInput] = useState("");
  const [pendingPaths, setPendingPaths] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenMessageIds = useRef(new Set<string>());

  useEffect(() => {
    setShowContactReminder(!hasSeenContactReminder());
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;

    async function loadInitial() {
      if (!activeChatId) return;
      const page = await fetchMessages(activeChatId);
      if (cancelled) return;
      const ordered = [...page.items].reverse();
      ordered.forEach((m) => seenMessageIds.current.add(m.id));
      setMessages(ordered);
      setNextCursor(page.nextCursor);
      markChatRead(activeChatId);
    }
    loadInitial();

    async function loadSummary() {
      const chats = await fetchMyChats();
      if (cancelled) return;
      const summary = chats.find((c) => c.id === activeChatId);
      if (summary) setIsBlockedByMe(summary.isBlockedByMe);
    }
    loadSummary();

    fetchDealsByChat(activeChatId).then((deals) => {
      if (!cancelled) setChatDeals(deals);
    });

    const interval = setInterval(async () => {
      if (!activeChatId) return;
      const page = await fetchMessages(activeChatId);
      if (cancelled) return;
      const fresh = page.items.filter((m) => !seenMessageIds.current.has(m.id));
      if (fresh.length > 0) {
        fresh.forEach((m) => seenMessageIds.current.add(m.id));
        setMessages((prev) => [...prev, ...[...fresh].reverse()]);
        markChatRead(activeChatId);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleLoadOlder() {
    if (!activeChatId || !nextCursor) return;
    setIsLoadingOlder(true);
    try {
      const page = await fetchMessages(activeChatId, nextCursor);
      page.items.forEach((m) => seenMessageIds.current.add(m.id));
      setMessages((prev) => [...[...page.items].reverse(), ...prev]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function handleAttach(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (pendingPaths.length + files.length > MAX_ATTACHMENTS) {
      setError(dictionary.chat.attachmentsLimitError);
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadChatAttachment(f)));
      setPendingPaths((prev) => [...prev, ...uploaded]);
    } catch {
      setError(dictionary.chat.uploadError);
    } finally {
      setIsUploading(false);
    }
  }

  function removePendingAttachment(path: string) {
    setPendingPaths((prev) => prev.filter((p) => p !== path));
  }

  async function handleSend() {
    const body = bodyInput.trim();
    if (!body && pendingPaths.length === 0) {
      setError(dictionary.chat.emptyMessageError);
      return;
    }
    setError(null);
    setIsSending(true);
    try {
      const input = { body: body || undefined, attachmentPaths: pendingPaths };
      const message = activeChatId
        ? await sendMessageToChat(activeChatId, input)
        : await sendMessageToListing(listingId, input);

      seenMessageIds.current.add(message.id);
      setMessages((prev) => [...prev, message]);
      setBodyInput("");
      setPendingPaths([]);

      if (!activeChatId) {
        setActiveChatId(message.chatId);
        onChatCreated?.(message.chatId);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSending(false);
    }
  }

  async function handleToggleBlock() {
    if (!activeChatId) return;
    if (isBlockedByMe) {
      await unblockChatCounterpart(activeChatId);
      setIsBlockedByMe(false);
    } else {
      await blockChatCounterpart(activeChatId);
      setIsBlockedByMe(true);
    }
  }

  function dismissContactReminder() {
    markContactReminderSeen();
    setShowContactReminder(false);
  }

  async function handleStartDeal() {
    if (!activeChatId) return;
    setIsStartingDeal(true);
    setError(null);
    try {
      const deal = await createDeal(activeChatId);
      router.push(`/deals/${deal.id}`);
    } catch {
      setError(dictionary.deal.genericError);
    } finally {
      setIsStartingDeal(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col md:h-[calc(100dvh-6rem)]">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Link href="/chat" className="text-sm text-muted-foreground hover:text-foreground">
          ← {dictionary.chat.backCta}
        </Link>
        <Link href={`/profile/${counterpart.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar
            initials={counterpart.initials}
            imageUrl={counterpart.avatarUrl}
            verified={counterpart.verified}
            size="sm"
          />
          <span className="font-heading truncate text-sm font-bold text-foreground">{counterpart.name}</span>
        </Link>
        {activeChatId ? (
          <>
            <ComplaintButton targetType="user" targetId={counterpart.id} />
            <button
              type="button"
              onClick={handleToggleBlock}
              className="font-heading shrink-0 rounded-sm border border-border px-2.5 py-1.5 text-xs font-bold text-destructive"
            >
              {isBlockedByMe ? dictionary.chat.unblockCta : dictionary.chat.blockCta}
            </button>
          </>
        ) : null}
      </div>

      {activeChatId ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 shadow-sm">
          {chatDeals.length > 0 ? (
            <Link
              href={`/deals/${chatDeals[0]!.id}`}
              className="font-heading text-sm font-bold text-primary"
            >
              {dictionary.deal.title}: {dictionary.deal.statusLabels[chatDeals[0]!.status]}
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleStartDeal}
              disabled={isStartingDeal}
              className="font-heading text-sm font-bold text-primary disabled:opacity-60"
            >
              {dictionary.deal.startCta}
            </button>
          )}
        </div>
      ) : null}

      {showContactReminder ? (
        <div className="mt-3 flex items-start gap-3 rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
          <p className="flex-1">{dictionary.chat.contactReminder}</p>
          <button
            type="button"
            onClick={dismissContactReminder}
            className="font-heading shrink-0 font-bold text-foreground"
          >
            {dictionary.chat.contactReminderDismiss}
          </button>
        </div>
      ) : null}

      {isBlockedByMe ? (
        <p className="mt-3 rounded-md bg-muted p-2.5 text-center text-xs text-muted-foreground">
          {dictionary.chat.blockedNotice}
        </p>
      ) : null}

      <div className="mt-3 flex-1 overflow-y-auto">
        {nextCursor ? (
          <div className="pb-2 text-center">
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={isLoadingOlder}
              className="text-xs font-medium text-primary disabled:opacity-50"
            >
              {dictionary.chat.loadOlderCta}
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{dictionary.chat.noMessages}</p>
        ) : (
          <div className="flex flex-col gap-2.5 pb-2">
            {messages.map((message) => {
              if (message.kind === "system") {
                return (
                  <p key={message.id} className="text-center text-xs text-muted-foreground">
                    {message.body}
                  </p>
                );
              }
              const isOwn = message.senderId !== counterpart.id;
              return (
                <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-md px-3.5 py-2.5 text-sm ${
                      isOwn ? "bg-primary text-on-primary" : "bg-card text-card-foreground shadow-sm"
                    }`}
                  >
                    {message.attachmentUrls.map((url) => (
                      // Подписанные ссылки на Storage — как и в Avatar, без next/image.
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="mb-1.5 max-h-64 max-w-full rounded-sm object-contain"
                      />
                    ))}
                    {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        isOwn ? "text-on-primary/70" : "text-muted-foreground"
                      }`}
                    >
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!isBlockedByMe ? (
        <div className="border-t border-border pt-3">
          {pendingPaths.length > 0 ? (
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {pendingPaths.map((path) => (
                <div key={path} className="relative shrink-0">
                  <div className="flex size-14 items-center justify-center rounded-sm border border-border bg-muted text-xs text-muted-foreground">
                    📷
                  </div>
                  <button
                    type="button"
                    onClick={() => removePendingAttachment(path)}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-white"
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}

          <div className="flex items-end gap-2">
            <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border text-lg text-muted-foreground">
              {isUploading ? "…" : "📎"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                disabled={isUploading || pendingPaths.length >= MAX_ATTACHMENTS}
                onChange={handleAttach}
              />
            </label>
            <textarea
              rows={1}
              value={bodyInput}
              onChange={(e) => setBodyInput(e.target.value)}
              placeholder={dictionary.chat.messagePlaceholder}
              maxLength={4000}
              className="flex-1 resize-none rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="font-heading h-10 shrink-0 rounded-sm bg-action px-4 text-sm font-bold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
            >
              {isSending ? dictionary.chat.sending : dictionary.chat.sendCta}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
