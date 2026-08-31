"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dictionary } from "@/lib/dictionary";
import { useSession } from "@/lib/auth";
import { fetchMyChats, type ChatSummary } from "@/lib/chat";
import { Avatar } from "@/components/Avatar";

const POLL_INTERVAL_MS = 15_000;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function previewText(chat: ChatSummary): string {
  const last = chat.lastMessage;
  if (!last) return "";
  if (last.kind === "photo") return "📷 Фото";
  if (last.kind === "system") return `${dictionary.chat.systemMessagePrefix}: ${last.body ?? ""}`;
  return last.body ?? "";
}

export default function ChatListPage() {
  const session = useSession();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);

  useEffect(() => {
    if (session.status !== "signedIn") return;
    let cancelled = false;

    const poll = () => {
      fetchMyChats().then((items) => {
        if (!cancelled) setChats(items);
      });
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session.status]);

  if (session.status === "loading") {
    return null;
  }

  if (session.status === "signedOut") {
    return (
      <div className="py-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{dictionary.chat.title}</h1>
        <div className="mt-5 rounded-md border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{dictionary.chat.signInHint}</p>
          <Link
            href="/login"
            className="font-heading mt-4 inline-block rounded-sm bg-action px-5 py-2.5 text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
          >
            {dictionary.auth.signInCta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{dictionary.chat.title}</h1>

      <div className="mt-5">
        {chats === null ? (
          <p className="text-sm text-muted-foreground">{dictionary.chat.loading}</p>
        ) : chats.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-5 text-center shadow-sm">
            <p className="text-sm font-medium text-foreground">{dictionary.chat.emptyTitle}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{dictionary.chat.emptyHint}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="flex items-center gap-3 rounded-md border border-border bg-card p-3.5 shadow-sm"
              >
                <Avatar
                  initials={chat.counterpart.initials}
                  imageUrl={chat.counterpart.avatarUrl}
                  verified={chat.counterpart.verified}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading truncate text-sm font-bold text-card-foreground">
                      {chat.counterpart.name}
                    </p>
                    {chat.lastMessage ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTimestamp(chat.lastMessage.createdAt)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{previewText(chat)}</p>
                </div>
                {chat.unreadCount > 0 ? (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-action px-1.5 text-xs font-bold text-on-action">
                    {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
