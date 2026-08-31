"use client";

import { use, useEffect, useState } from "react";
import { AdminApiError } from "@/lib/api";
import { fetchDeal, resolveDeal, type AdminDeal } from "@/lib/admin-deals";

/** ТЗ E16 п.16.22-16.23 — полная карточка сделки; ручной смены статуса нет, только решение по проблеме. */
export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [deal, setDeal] = useState<AdminDeal | null>(null);
  const [action, setAction] = useState<"warn" | "ban_user" | "reject" | null>(null);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchDeal(id)
      .then(setDeal)
      .catch(() => setDeal(null));
  }, [id]);

  async function handleSubmit() {
    if (!action || reason.trim().length < 3) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await resolveDeal(id, { action, reason, ...(userId ? { userId } : {}) });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Не получилось сохранить решение");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (deal === null) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {deal.fromCity} → {deal.toCity}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Статус: {deal.status}</p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-[var(--color-muted-foreground)]">Заказчик</dt>
          <dd>{deal.customer.name}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Курьер</dt>
          <dd>{deal.courier.name}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Заявленный вес</dt>
          <dd>{deal.declaredWeightGrams ? `${deal.declaredWeightGrams / 1000} кг` : "—"}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Фактический вес</dt>
          <dd>{deal.actualWeightGrams ? `${deal.actualWeightGrams / 1000} кг` : "—"}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Оплачиваемый вес</dt>
          <dd>{deal.payableWeightGrams ? `${deal.payableWeightGrams / 1000} кг` : "—"}</dd>
          <dt className="text-[var(--color-muted-foreground)]">Цена</dt>
          <dd>{deal.priceMinor ? `${deal.priceMinor / 100} ${deal.currencySymbol}` : "—"}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Опись</p>
          <pre className="mt-2 max-h-48 overflow-auto text-xs">{JSON.stringify(deal.items, null, 2)}</pre>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Контакты</p>
          <pre className="mt-2 max-h-48 overflow-auto text-xs">{JSON.stringify(deal.contacts, null, 2)}</pre>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <p className="text-sm font-medium text-[var(--color-muted-foreground)]">История статусов</p>
        <div className="mt-2 flex flex-col gap-1 text-sm">
          {deal.statusLog.map((entry, i) => (
            <p key={i}>
              {new Date(entry.createdAt).toLocaleString("ru-RU")} — {entry.toStatus}
              {entry.comment ? ` (${entry.comment})` : ""}
            </p>
          ))}
        </div>
      </div>

      {deal.status === "problem" ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <p className="text-sm font-medium">Решение по проблемной сделке</p>
          {success ? (
            <p className="mt-2 text-sm text-[var(--color-success)]">Решение сохранено.</p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["reject", "warn", "ban_user"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAction(a)}
                    className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm ${
                      action === a ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "border-[var(--color-border)]"
                    }`}
                  >
                    {a === "reject" ? "Отклонить (без последствий)" : a === "warn" ? "Предупредить" : "Заблокировать"}
                  </button>
                ))}
              </div>
              {action && action !== "reject" ? (
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="mt-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
                >
                  <option value="">Кого — выберите сторону</option>
                  <option value={deal.customer.id}>Заказчик: {deal.customer.name}</option>
                  <option value={deal.courier.id}>Курьер: {deal.courier.name}</option>
                </select>
              ) : null}
              {action ? (
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Причина (обязательно)"
                  className="mt-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
                />
              ) : null}
              {error ? <p className="mt-2 text-sm text-[var(--color-destructive)]">{error}</p> : null}
              {action ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || reason.trim().length < 3 || (action !== "reject" && !userId)}
                  className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
                >
                  Применить
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
