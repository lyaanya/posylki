"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { useUnreadChatCount } from "@/lib/use-unread-chats";

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path
        d="M4 5.5h16a1 1 0 011 1V16a1 1 0 01-1 1H9l-4.5 4V17H4a1 1 0 01-1-1V6.5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold text-on-action">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4.5v-6h-5v6H5a1 1 0 01-1-1z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path
        d="M4.5 20c1.4-3.4 4.4-5.5 7.5-5.5s6.1 2.1 7.5 5.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const isFeed = pathname === "/";
  const isChats = pathname === "/chat" || pathname.startsWith("/chat/");
  const isProfile = pathname === "/profile";
  const unreadCount = useUnreadChatCount();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-around px-4 py-2">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs ${
            isFeed ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <FeedIcon active={isFeed} />
          {dictionary.nav.feed}
        </Link>

        <Link
          href="/chat"
          className={`relative flex flex-col items-center gap-0.5 px-4 py-1 text-xs ${
            isChats ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <span className="relative inline-flex">
            <ChatIcon active={isChats} />
            <UnreadBadge count={unreadCount} />
          </span>
          {dictionary.nav.chats}
        </Link>

        <Link
          href="/listings/new"
          aria-label={dictionary.feed.createCta}
          className="-mt-6 flex size-12 items-center justify-center rounded-full bg-action text-on-action shadow-md transition-colors hover:bg-action-hover"
        >
          <PlusIcon />
        </Link>

        <Link
          href="/profile"
          className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs ${
            isProfile ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <ProfileIcon active={isProfile} />
          {dictionary.nav.profile}
        </Link>
      </div>
    </nav>
  );
}
