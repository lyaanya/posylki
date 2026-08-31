"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { useSession } from "@/lib/auth";
import { fetchListing, type Listing } from "@/lib/listings";
import { fetchMyProfile } from "@/lib/profile";
import { findChatByListing } from "@/lib/chat";
import { ChatThreadView } from "@/components/ChatThreadView";

/**
 * "Написать" с карточки объявления. Если чат по этому объявлению уже есть —
 * сразу уходим в него (/chat/[chatId]), иначе показываем композер: чат
 * создастся неявно при первом сообщении (ТЗ п.9.4, sendMessageToListing).
 */
export default function NewListingChatPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const router = useRouter();
  const session = useSession();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [selfBlocked, setSelfBlocked] = useState(false);

  useEffect(() => {
    if (session.status !== "signedIn") return;
    let cancelled = false;

    async function load() {
      const [found, existingChat, myProfile] = await Promise.all([
        fetchListing(listingId),
        findChatByListing(listingId),
        fetchMyProfile(),
      ]);
      if (cancelled) return;

      if (existingChat) {
        router.replace(`/chat/${existingChat.id}`);
        return;
      }
      if (found && found.courier.id === myProfile.id) {
        setSelfBlocked(true);
      }
      setListing(found);
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [session.status, listingId, router]);

  if (session.status === "loading" || listing === undefined) {
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

  if (selfBlocked || !listing) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{dictionary.publicProfile.notFound}</p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-primary">
          {dictionary.publicProfile.backToFeed}
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      <ChatThreadView
        chatId={null}
        listingId={listing.id}
        counterpart={listing.courier}
        onChatCreated={(chatId) => router.replace(`/chat/${chatId}`)}
      />
    </div>
  );
}
