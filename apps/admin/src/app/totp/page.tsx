"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminApiError } from "@/lib/api";
import { fetchTotpStatus, setupTotp, verifyTotp } from "@/lib/totp";

/**
 * ТЗ E16 п.16.3 — двухфакторная аутентификация обязательна. Первый вход
 * сотрудника показывает секрет для ручного ввода в приложение-
 * аутентификатор (без QR — см. apps/api/src/admin/totp.ts); все
 * следующие входы — просто поле для кода.
 */
export default function TotpPage() {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTotpStatus()
      .then((s) => setEnrolled(s.enrolled))
      .catch(() => router.push("/login"));
  }, [router]);

  async function handleSetup() {
    const { secret } = await setupTotp();
    setPendingSecret(secret);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyTotp(code, pendingSecret ?? undefined);
      router.push("/");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Не получилось подтвердить код");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (enrolled === null) {
    return <p className="p-6 text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>;
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-md)]">
        <h1 className="text-xl font-semibold">Двухфакторная аутентификация</h1>

        {!enrolled && !pendingSecret ? (
          <>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Это первый вход. Привяжите приложение-аутентификатор (Google Authenticator, Authy, 1Password и т.п.).
            </p>
            <button
              type="button"
              onClick={handleSetup}
              className="mt-5 w-full rounded-[var(--radius-sm)] bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-[var(--color-on-primary)]"
            >
              Привязать
            </button>
          </>
        ) : (
          <>
            {pendingSecret ? (
              <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-muted)] p-3">
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Введите этот код вручную в приложение-аутентификатор:
                </p>
                <p className="mt-1.5 select-all break-all font-mono text-sm">{pendingSecret}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                Введите код из приложения-аутентификатора.
              </p>
            )}

            <form onSubmit={handleVerify}>
              <label className="mt-4 block text-sm font-medium">Код</label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-center text-lg tracking-[0.3em] outline-none focus:border-[var(--color-primary)]"
              />

              {error ? <p className="mt-3 text-sm text-[var(--color-destructive)]">{error}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting || code.length !== 6}
                className="mt-5 w-full rounded-[var(--radius-sm)] bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
              >
                {isSubmitting ? "Проверяем…" : "Подтвердить"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
