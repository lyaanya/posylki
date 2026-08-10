"use client";

import { useMemo, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { listings, type ListingType } from "@/lib/mock-data";
import { ListingCard } from "@/components/ListingCard";

const quickRoutes = [
  { from: "Москва", to: "Нячанг" },
  { from: "Санкт-Петербург", to: "Хошимин" },
  { from: "Алматы", to: "Дананг" },
  { from: "Нячанг", to: "Красноярск" },
];

export default function FeedPage() {
  const [tab, setTab] = useState<ListingType>("trip");
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");

  const filtered = useMemo(() => {
    return listings
      .filter((listing) => {
        const matchesTab = listing.type === tab;
        const matchesFrom =
          fromQuery.trim().length === 0 ||
          listing.fromCity.toLowerCase().includes(fromQuery.toLowerCase());
        const matchesTo =
          toQuery.trim().length === 0 ||
          listing.toCity.toLowerCase().includes(toQuery.toLowerCase());
        return matchesTab && matchesFrom && matchesTo;
      })
      .sort((a, b) => b.courier.rating - a.courier.rating)
      .slice(0, 5);
  }, [tab, fromQuery, toQuery]);

  return (
    <div className="py-10 text-center">
      <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
        {dictionary.feed.heroTitle}
      </h1>

      <div className="mt-6 inline-flex rounded-full border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("trip")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "trip" ? "bg-primary text-on-primary" : "text-muted-foreground"
          }`}
        >
          {dictionary.feed.tripsTab}
        </button>
        <button
          type="button"
          onClick={() => setTab("request")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "request" ? "bg-primary text-on-primary" : "text-muted-foreground"
          }`}
        >
          {dictionary.feed.requestsTab}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-left shadow-md sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:divide-x sm:divide-border">
          <div className="sm:px-4 sm:first:pl-0">
            <label className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {dictionary.createListing.fromLabel}
            </label>
            <input
              value={fromQuery}
              onChange={(e) => setFromQuery(e.target.value)}
              placeholder={dictionary.feed.anyCity}
              className="w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
            />
          </div>
          <div className="sm:px-4">
            <label className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {dictionary.createListing.toLabel}
            </label>
            <input
              value={toQuery}
              onChange={(e) => setToQuery(e.target.value)}
              placeholder={dictionary.feed.anyCity}
              className="w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
            />
          </div>
          <div className="sm:px-4">
            <span className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {dictionary.feed.dateLabel}
            </span>
            <p className="text-base font-semibold text-foreground">{dictionary.feed.dateAny}</p>
          </div>
          <div className="sm:pl-4">
            <span className="block text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {dictionary.feed.cargoLabel}
            </span>
            <p className="text-base font-semibold text-foreground">{dictionary.feed.cargoAny}</p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
        >
          {dictionary.feed.searchCta}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {quickRoutes.map((route) => (
          <button
            key={`${route.from}-${route.to}`}
            type="button"
            onClick={() => {
              setFromQuery(route.from);
              setToQuery(route.to);
            }}
            className="rounded-full bg-muted px-3.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-border"
          >
            {route.from} → {route.to}
          </button>
        ))}
      </div>

      <div className="mt-10 text-left">
        <h2 className="font-heading text-lg font-bold text-foreground">
          {dictionary.feed.resultsTitle}
        </h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="font-medium text-foreground">{dictionary.feed.emptyTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{dictionary.feed.emptyHint}</p>
            </div>
          ) : (
            filtered.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} rank={index + 1} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
