"use client";

import { useEffect, useRef, useState } from "react";
import { searchCities, type City } from "@/lib/directories";

/**
 * Поиск города со справочником (E05 п. 5.2, задача 5.8): текстовое поле,
 * которое по мере ввода запрашивает /directories/cities?q= — раскладка
 * и синонимы обрабатываются на бэкенде, здесь только debounce и список.
 * Если API недоступен, поле остаётся обычным текстовым вводом — без
 * подсказок, но не ломается.
 */
export function CityPicker({
  label,
  placeholder,
  value,
  onChange,
}: {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<City[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  // Более раннему запросу нельзя позволить перезаписать результат более
  // позднего, если он ответит позже (гонка сети, а не только debounce).
  const latestRequestId = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = setTimeout(() => {
      const requestId = ++latestRequestId.current;
      searchCities(value)
        .then((cities) => {
          if (requestId === latestRequestId.current) {
            setResults(cities);
          }
        })
        .catch(() => {
          if (requestId === latestRequestId.current) {
            setResults([]);
          }
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative min-w-0">
      {label ? (
        <span className="block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
      ) : null}
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full min-w-0 truncate bg-transparent text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute top-full left-0 z-20 mt-2 max-h-64 w-56 overflow-auto rounded-md border border-border bg-card py-1 shadow-lg">
          {results.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(city.nameRu);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
              >
                <span>{city.nameRu}</span>
                <span className="text-xs text-muted-foreground">{city.countryCode}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
