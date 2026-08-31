"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchDeals, type AdminDeal } from "@/lib/admin-deals";

const STATUSES = ["", "responded", "agreed", "handed_over", "in_transit", "awaiting_pickup", "delivered", "completed", "cancelled", "problem"];

/** ТЗ E16 п.16.21 — список сделок с фильтром по статусу; ручной смены статуса здесь нет (16.23). */
export default function DealsListPage() {
  const [deals, setDeals] = useState<AdminDeal[] | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchDeals(status ? { status } : {})
      .then(setDeals)
      .catch(() => setDeals([]));
  }, [status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Сделки</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || "Все статусы"}
            </option>
          ))}
        </select>
      </div>

      {deals === null ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>
      ) : deals.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Ничего не найдено</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted-foreground)]">
                <th className="p-3 font-medium">Маршрут</th>
                <th className="p-3 font-medium">Заказчик</th>
                <th className="p-3 font-medium">Курьер</th>
                <th className="p-3 font-medium">Статус</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} className="border-b border-[var(--color-border)] last:border-none">
                  <td className="p-3">
                    {deal.fromCity} → {deal.toCity}
                  </td>
                  <td className="p-3 text-[var(--color-muted-foreground)]">{deal.customer.name}</td>
                  <td className="p-3 text-[var(--color-muted-foreground)]">{deal.courier.name}</td>
                  <td className="p-3">{deal.status}</td>
                  <td className="p-3 text-right">
                    <Link href={`/deals/${deal.id}`} className="text-[var(--color-primary)] hover:underline">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
