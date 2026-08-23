"use client";

import { useMemo, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { listings, type ListingType } from "@/lib/mock-data";
import { ListingCard } from "@/components/ListingCard";
import { CityPicker } from "@/components/CityPicker";

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
      .sort((a, b) => b.courier.rating - a.courier.rating);
  }, [tab, fromQuery, toQuery]);

  return (
    <div>
      <div className="hero-gradient -mx-4 rounded-b-lg px-4 pt-10 pb-6 text-center sm:-mx-6 sm:px-6">
        <p className="font-heading text-[11px] font-extrabold tracking-[0.1em] text-foreground uppercase">
          {dictionary.feed.eyebrow}
        </p>
        <h1 className="font-heading mt-3 text-[27px] leading-tight font-extrabold text-foreground">
          {dictionary.feed.heroTitle}
        </h1>
        <p className="mx-auto mt-2 max-w-[38ch] text-sm text-foreground/70">
          {dictionary.feed.heroSubtitle}
        </p>

        <div className="mx-auto mt-6 max-w-3xl rounded-lg bg-card p-1.5 text-left shadow-lg">
          <div className="flex flex-col items-stretch sm:flex-row">
            <div className="min-w-0 flex-1 border-b border-border px-4 py-2.5 sm:border-r sm:border-b-0">
              <CityPicker
                label={dictionary.createListing.fromLabel}
                placeholder={dictionary.feed.anyCity}
                value={fromQuery}
                onChange={setFromQuery}
              />
            </div>
            <div className="min-w-0 flex-1 border-b border-border px-4 py-2.5 sm:border-r sm:border-b-0">
              <CityPicker
                label={dictionary.createListing.toLabel}
                placeholder={dictionary.feed.anyCity}
                value={toQuery}
                onChange={setToQuery}
              />
            </div>
            <div className="min-w-0 flex-1 px-4 py-2.5">
              <span className="block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                {dictionary.feed.dateLabel}
              </span>
              <p className="truncate text-sm font-semibold text-foreground">
                {dictionary.feed.dateAny}
              </p>
            </div>
            <button
              type="button"
              className="m-1 shrink-0 rounded-sm bg-action px-6 font-heading text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
            >
              {dictionary.feed.searchCta}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-extrabold text-foreground">
          {dictionary.feed.resultsTitle}
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            {dictionary.feed.foundCount(filtered.length)}
          </span>
        </h2>
        <div className="inline-flex rounded-sm border border-border p-0.5">
          <button
            type="button"
            onClick={() => setTab("trip")}
            className={`font-heading rounded-sm px-3 py-1 text-sm font-bold transition-colors ${
              tab === "trip" ? "bg-primary text-on-primary" : "text-muted-foreground"
            }`}
          >
            {dictionary.feed.tripsTab}
          </button>
          <button
            type="button"
            onClick={() => setTab("request")}
            className={`font-heading rounded-sm px-3 py-1 text-sm font-bold transition-colors ${
              tab === "request" ? "bg-primary text-on-primary" : "text-muted-foreground"
            }`}
          >
            {dictionary.feed.requestsTab}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-md border border-border bg-card px-4 py-10 text-center">
          <p className="font-medium text-foreground">{dictionary.feed.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{dictionary.feed.emptyHint}</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-[#E7DCCF] pt-3">
        <div className="flex items-center gap-2">
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-white">
            <svg width="9" height="9" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4 10.5l3.5 3.5L16 5.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="font-heading text-xs font-bold text-foreground">
            {dictionary.feed.trustTitle}
          </p>
        </div>
        <div className="mt-2.5 flex flex-col gap-2 text-[11px] leading-tight text-[#3A3D42] sm:flex-row sm:gap-6">
          <div className="flex-1">
            <b className="font-heading block text-foreground">{dictionary.feed.trustDocument}</b>
            {dictionary.feed.trustDocumentText}
          </div>
          <div className="flex-1">
            <b className="font-heading block text-foreground">{dictionary.feed.trustStorage}</b>
            {dictionary.feed.trustStorageText}
          </div>
          <div className="flex-1">
            <b className="font-heading block text-foreground">{dictionary.feed.trustAge}</b>
            {dictionary.feed.trustAgeText}
          </div>
        </div>
      </div>
    </div>
  );
}
