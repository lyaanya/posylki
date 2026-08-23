"use client";

import { useEffect, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { fetchWeightReferences, type WeightReference } from "@/lib/directories";

/**
 * Подсказка «сколько весит», разворачивается рядом с полем веса
 * (E05 п. 5.11, задача 5.9) — справочник грузится один раз при открытии.
 */
export function WeightHint() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<WeightReference[] | null>(null);

  useEffect(() => {
    if (isOpen && items === null) {
      fetchWeightReferences()
        .then(setItems)
        .catch(() => setItems([]));
    }
  }, [isOpen, items]);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="text-xs font-semibold text-primary underline decoration-dotted underline-offset-2"
      >
        {dictionary.createListing.weightHintCta}
      </button>
      {isOpen && (
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-sm border border-border bg-card-alt p-3 text-xs text-muted-foreground">
          {items === null ? (
            <li className="col-span-2">{dictionary.createListing.weightHintLoading}</li>
          ) : items.length === 0 ? (
            <li className="col-span-2">{dictionary.createListing.weightHintEmpty}</li>
          ) : (
            items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="shrink-0 text-foreground">
                  {item.weightGramsMax ? `${item.weightGrams}–${item.weightGramsMax}` : item.weightGrams} г
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
