"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Сводка" },
  { href: "/verification", label: "Верификация" },
  { href: "/moderation", label: "Модерация" },
  { href: "/users", label: "Пользователи" },
  { href: "/deals", label: "Сделки" },
  { href: "/support", label: "Поддержка" },
  { href: "/directories", label: "Справочники" },
  { href: "/legal", label: "Юр. документы" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-[var(--color-border)] bg-[var(--color-card)] p-4">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => signOut().then(() => window.location.assign("/login"))}
        className="mt-4 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
      >
        Выйти
      </button>
    </nav>
  );
}
