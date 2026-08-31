"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchVerificationQueue, type VerificationQueueItem } from "@/lib/verification";

/** ТЗ E16 пп.16.6, 16.11 — очередь от старых к новым, время ожидания, среднее по очереди. */
export default function VerificationQueuePage() {
  const [items, setItems] = useState<VerificationQueueItem[] | null>(null);
  const [averageWaitingMinutes, setAverageWaitingMinutes] = useState(0);

  useEffect(() => {
    fetchVerificationQueue()
      .then((data) => {
        setItems(data.items);
        setAverageWaitingMinutes(data.averageWaitingMinutes);
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Очередь верификации</h1>
        {items && items.length > 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            В очереди: {items.length} · среднее ожидание: {averageWaitingMinutes} мин
          </p>
        ) : null}
      </div>

      {items === null ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Очередь пуста</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted-foreground)]">
                <th className="p-3 font-medium">Имя</th>
                <th className="p-3 font-medium">Тип документа</th>
                <th className="p-3 font-medium">Подана</th>
                <th className="p-3 font-medium">Ожидает, мин</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--color-border)] last:border-none">
                  <td className="p-3">
                    {item.submittedFirstName} {item.submittedLastName}
                  </td>
                  <td className="p-3 text-[var(--color-muted-foreground)]">{item.documentType}</td>
                  <td className="p-3 text-[var(--color-muted-foreground)]">
                    {new Date(item.createdAt).toLocaleString("ru-RU")}
                  </td>
                  <td className="p-3">{item.waitingMinutes}</td>
                  <td className="p-3 text-right">
                    <Link href={`/verification/${item.id}`} className="text-[var(--color-primary)] hover:underline">
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
