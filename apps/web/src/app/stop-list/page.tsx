"use client";

import { useEffect, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { fetchStopList, type StopListItem } from "@/lib/directories";

/** Показ стоп-листа (E05 п. 5.14, задача 5.9) — читается при заполнении описи. */
export default function StopListPage() {
  const [items, setItems] = useState<StopListItem[] | null>(null);

  useEffect(() => {
    fetchStopList()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{dictionary.stopList.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{dictionary.stopList.subtitle}</p>

      <div className="mt-5 overflow-hidden rounded-md border border-border">
        {items === null ? (
          <p className="bg-card px-4 py-6 text-sm text-muted-foreground">{dictionary.stopList.loading}</p>
        ) : items.length === 0 ? (
          <p className="bg-card px-4 py-6 text-sm text-muted-foreground">{dictionary.stopList.empty}</p>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className={`bg-card px-4 py-3 ${index > 0 ? "border-t border-border" : ""}`}>
              <p className="text-sm font-semibold text-card-foreground">{item.name}</p>
              {item.explanation ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.explanation}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
