"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword } from "@/lib/auth";

/** ТЗ E16 п.16.1/16.3 — вход по почте и паролю, второй фактор проверяется дальше на /totp. */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
      router.push("/totp");
    } catch {
      setError("Неверная почта или пароль");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-md)]"
      >
        <h1 className="text-xl font-semibold">Вход в админ-панель</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Только для сотрудников сервиса.
        </p>

        <label className="mt-5 block text-sm font-medium">Почта</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />

        <label className="mt-4 block text-sm font-medium">Пароль</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        />

        {error ? <p className="mt-3 text-sm text-[var(--color-destructive)]">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 w-full rounded-[var(--radius-sm)] bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
        >
          {isSubmitting ? "Входим…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
