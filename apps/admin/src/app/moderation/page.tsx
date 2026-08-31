"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchModerationQueue, type ModerationQueueItem } from "@/lib/moderation";

const SOURCE_LABEL: Record<ModerationQueueItem["source"], string> = {
  complaint: "Жалоба",
  problem_deal: "Проблемная сделка",
  ai_flag: "Помечено ИИ",
};

/** ТЗ E16 п.16.12-16.13 — единая очередь: жалобы, проблемные сделки, объявления от ИИ. Сортировка от старых к новым. */
export default function ModerationQueuePage() {
  const [items, setItems] = useState<ModerationQueueItem[] | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | ModerationQueueItem["source"]>("all");

  useEffect(() => {
    fetchModerationQueue()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const filtered = items?.filter((i) => sourceFilter === "all" || i.source === sourceFilter) ?? null;

  function linkFor(item: ModerationQueueItem): string {
    if (item.source === "complaint") return `/moderation/complaint/${item.id}`;
    if (item.source === "problem_deal") return `/deals/${item.id}`;
    return item.detailPath;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Очередь модерации</h1>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm"
        >
          <option value="all">Все типы</option>
          <option value="complaint">Жалобы</option>
          <option value="problem_deal">Проблемные сделки</option>
          <option value="ai_flag">Помечено ИИ</option>
        </select>
      </div>

      {filtered === null ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Очередь пуста</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <Link
              key={`${item.source}-${item.id}`}
              href={linkFor(item)}
              target={item.source === "ai_flag" ? "_blank" : undefined}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-sm)] hover:border-[var(--color-primary)]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                  {SOURCE_LABEL[item.source]}
                </span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {new Date(item.createdAt).toLocaleString("ru-RU")}
                </span>
              </div>
              <p className="mt-2 text-sm">{item.summary}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
