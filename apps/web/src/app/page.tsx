"use client";

import { useMemo, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { listings, type ListingType } from "@/lib/mock-data";
import { ListingCard } from "@/components/ListingCard";

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4 text-muted-foreground"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 17l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function FeedPage() {
  const [tab, setTab] = useState<ListingType>("trip");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return listings.filter((listing) => {
      const matchesTab = listing.type === tab;
      const matchesQuery =
        query.trim().length === 0 ||
        `${listing.fromCity} ${listing.toCity}`.toLowerCase().includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [tab, query]);

  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{dictionary.feed.title}</h1>

      <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm">
        <SearchIcon />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dictionary.feed.searchPlaceholder}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-4 inline-flex rounded-full border border-border bg-card p-1">
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

      <div className="mt-4 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
            <p className="font-medium text-foreground">{dictionary.feed.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{dictionary.feed.emptyHint}</p>
          </div>
        ) : (
          filtered.map((listing) => <ListingCard key={listing.id} listing={listing} />)
        )}
      </div>
    </div>
  );
}
