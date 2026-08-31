"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";
import { useSession } from "@/lib/auth";
import { initials } from "@/lib/initials";
import { useUnreadChatCount } from "@/lib/use-unread-chats";
import { useUnreadNotificationCount } from "@/lib/use-unread-notifications";

const navLinks = [
  { href: "/", label: dictionary.nav.feed },
  { href: "/chat", label: dictionary.nav.chats },
  { href: "/profile", label: dictionary.nav.profile },
];

export function Header() {
  const pathname = usePathname();
  const session = useSession();
  const unreadCount = useUnreadChatCount();
  const unreadNotifications = useUnreadNotificationCount();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="VEZZY">
          <Logo className="h-12 w-auto" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-sm font-medium transition-colors ${
                pathname === link.href || (link.href === "/chat" && pathname.startsWith("/chat/"))
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
              {link.href === "/chat" && unreadCount > 0 ? (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold text-on-action align-top">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/listings/new"
            className="hidden rounded-sm bg-action px-4 py-2 font-heading text-sm font-bold text-on-action transition-colors hover:bg-action-hover sm:inline-block"
          >
            {dictionary.feed.createCta}
          </Link>
          {session.status === "signedIn" && session.email ? (
            <>
              <Link href="/notifications" aria-label={dictionary.notifications.title} className="relative">
                <span className="text-xl">🔔</span>
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold text-on-action">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                ) : null}
              </Link>
              <Link href="/profile" aria-label={dictionary.nav.profile}>
                <Avatar initials={initials(session.displayName ?? session.email)} size="sm" />
              </Link>
            </>
          ) : session.status === "signedOut" ? (
            <Link
              href="/login"
              className="rounded-sm border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {dictionary.auth.signInCta}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
