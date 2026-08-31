"use client";

import { useState } from "react";
import Link from "next/link";
import { searchUsers, type AdminUserSearchResult } from "@/lib/admin-users";

/** ТЗ E16 п.16.17 — поиск по имени, почте, идентификатору, телефону. */
export default function UsersSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length === 0) return;
    setIsSearching(true);
    try {
      setResults(await searchUsers(query.trim()));
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Пользователи</h1>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя, почта, id или телефон"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
        >
          Найти
        </button>
      </form>

      {results !== null ? (
        results.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">Ничего не найдено</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted-foreground)]">
                  <th className="p-3 font-medium">Имя</th>
                  <th className="p-3 font-medium">Почта</th>
                  <th className="p-3 font-medium">Телефон</th>
                  <th className="p-3 font-medium">Верификация</th>
                  <th className="p-3 font-medium">Статус</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--color-border)] last:border-none">
                    <td className="p-3">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="p-3 text-[var(--color-muted-foreground)]">{user.email}</td>
                    <td className="p-3 text-[var(--color-muted-foreground)]">{user.phone ?? "—"}</td>
                    <td className="p-3">{user.verificationStatus}</td>
                    <td className="p-3">{user.isBlocked ? "заблокирован" : "активен"}</td>
                    <td className="p-3 text-right">
                      <Link href={`/users/${user.id}`} className="text-[var(--color-primary)] hover:underline">
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
