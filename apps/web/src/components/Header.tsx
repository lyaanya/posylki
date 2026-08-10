"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";
import { currentUser } from "@/lib/mock-data";

const navLinks = [
  { href: "/", label: dictionary.nav.feed },
  { href: "/profile", label: dictionary.nav.profile },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-primary" aria-label="VEZZY">
          <Logo className="h-7 w-auto" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/listings/new"
            className="hidden rounded-full bg-action px-4 py-2 text-sm font-medium text-on-action transition-colors hover:bg-action-hover sm:inline-block"
          >
            {dictionary.feed.createCta}
          </Link>
          <Link href="/profile" aria-label={dictionary.nav.profile}>
            <Avatar initials={currentUser.initials} verified={currentUser.verified} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
