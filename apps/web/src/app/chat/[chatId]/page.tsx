"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { dictionary } from "@/lib/dictionary";
import { useSession } from "@/lib/auth";
import { fetchMyChats, type ChatSummary } from "@/lib/chat";
import { ChatThreadView } from "@/components/ChatThreadView";

export default function ChatThreadPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params);
  const session = useSession();
  const [chat, setChat] = useState<ChatSummary | null | undefined>(undefined);

  useEffect(() => {
    if (session.status !== "signedIn") return;
    let cancelled = false;
    fetchMyChats().then((chats) => {
      if (cancelled) return;
      setChat(chats.find((c) => c.id === chatId) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [session.status, chatId]);

  if (session.status === "loading" || chat === undefined) {
    return null;
  }

  if (session.status === "signedOut") {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{dictionary.chat.signInHint}</p>
        <Link href="/login" className="mt-3 inline-block text-sm font-medium text-primary">
          {dictionary.auth.signInCta}
        </Link>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{dictionary.publicProfile.notFound}</p>
        <Link href="/chat" className="mt-3 inline-block text-sm font-medium text-primary">
          {dictionary.chat.backCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      <ChatThreadView chatId={chat.id} listingId={chat.listingId} counterpart={chat.counterpart} />
    </div>
  );
}
