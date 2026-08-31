"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import {
  fetchDemandCount,
  fetchListingsPage,
  fetchNearbyDates,
  type Listing,
  type ListingSort,
  type ListingType,
} from "@/lib/listings";
import { resolveCityId, fetchCurrencies, type Currency } from "@/lib/directories";
import { createSubscription } from "@/lib/subscriptions";
import { rememberReferrerFromUrl } from "@/lib/referral";
import { useSession } from "@/lib/auth";
import { ListingCard } from "@/components/ListingCard";
import { CityPicker } from "@/components/CityPicker";

const STORAGE_KEY = "vezzy-feed-filters";
const PAGE_SIZE = 12;

interface FeedFilters {
  type: ListingType;
  fromCity: string;
  toCity: string;
  dateFrom: string;
  dateTo: string;
  weightMinKg: string;
  priceMaxPerKg: string;
  currencyCode: string;
  verifiedOnly: boolean;
  sortBy: ListingSort;
}

const DEFAULT_FILTERS: FeedFilters = {
  type: "trip",
  fromCity: "",
  toCity: "",
  dateFrom: "",
  dateTo: "",
  weightMinKg: "",
  priceMaxPerKg: "",
  currencyCode: "",
  verifiedOnly: false,
  sortBy: "date",
};

function filtersFromParams(params: URLSearchParams): FeedFilters | null {
  if ([...params.keys()].length === 0) return null;
  return {
    type: params.get("type") === "request" ? "request" : "trip",
    fromCity: params.get("fromCity") ?? "",
    toCity: params.get("toCity") ?? "",
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    weightMinKg: params.get("weightMinKg") ?? "",
    priceMaxPerKg: params.get("priceMaxPerKg") ?? "",
    currencyCode: params.get("currencyCode") ?? "",
    verifiedOnly: params.get("verifiedOnly") === "true",
    sortBy: (params.get("sortBy") as ListingSort | null) ?? "date",
  };
}

function filtersToSearch(f: FeedFilters): string {
  const p = new URLSearchParams();
  p.set("type", f.type);
  if (f.fromCity) p.set("fromCity", f.fromCity);
  if (f.toCity) p.set("toCity", f.toCity);
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo) p.set("dateTo", f.dateTo);
  if (f.weightMinKg) p.set("weightMinKg", f.weightMinKg);
  if (f.priceMaxPerKg) p.set("priceMaxPerKg", f.priceMaxPerKg);
  if (f.currencyCode) p.set("currencyCode", f.currencyCode);
  if (f.verifiedOnly) p.set("verifiedOnly", "true");
  if (f.sortBy !== "date") p.set("sortBy", f.sortBy);
  return p.toString();
}

export default function FeedPage() {
  const router = useRouter();
  const session = useSession();
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [pending, setPending] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [listings, setListings] = useState<Listing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [demandCount, setDemandCount] = useState<number | null>(null);
  const [nearbyDates, setNearbyDates] = useState<string[]>([]);
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "saving" | "done">("idle");

  // Восстановление фильтров (ТЗ п.8.8, 8.9): сначала адресная строка,
  // если пусто — то, что сохранено на устройстве с прошлого раза.
  useEffect(() => {
    rememberReferrerFromUrl();
    const fromUrl = filtersFromParams(new URLSearchParams(window.location.search));
    if (fromUrl) {
      setFilters(fromUrl);
      setPending(fromUrl);
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FeedFilters;
        setFilters(parsed);
        setPending(parsed);
      }
    } catch {
      // Нет доступа к localStorage — просто используем фильтры по умолчанию.
    }
  }, []);

  useEffect(() => {
    fetchCurrencies()
      .then(setCurrencies)
      .catch(() => setCurrencies([]));
  }, []);

  const runSearch = useCallback(async (f: FeedFilters) => {
    setIsLoading(true);
    setHasError(false);
    setDemandCount(null);
    setNearbyDates([]);
    setSubscribeStatus("idle");

    try {
      const [fromCityId, toCityId] = await Promise.all([
        f.fromCity ? resolveCityId(f.fromCity) : Promise.resolve(undefined),
        f.toCity ? resolveCityId(f.toCity) : Promise.resolve(undefined),
      ]);

      const page = await fetchListingsPage({
        type: f.type,
        fromCityId: fromCityId ?? undefined,
        toCityId: toCityId ?? undefined,
        dateFrom: f.dateFrom || undefined,
        dateTo: f.dateTo || undefined,
        weightMinKg: f.weightMinKg ? Number(f.weightMinKg) : undefined,
        priceMaxPerKg:
          f.priceMaxPerKg && f.currencyCode ? Number(f.priceMaxPerKg) : undefined,
        currencyCode: f.currencyCode || undefined,
        verifiedOnly: f.verifiedOnly,
        sortBy: f.currencyCode ? f.sortBy : f.sortBy === "price" ? "date" : f.sortBy,
        limit: PAGE_SIZE,
      });
      setListings(page.items);
      setNextCursor(page.nextCursor);

      // Пустая выдача по конкретному маршруту (ТЗ п.8.15) — считаем спрос
      // и соседние даты только когда города вообще выбраны.
      if (page.items.length === 0 && fromCityId && toCityId) {
        const [count, dates] = await Promise.all([
          fetchDemandCount(fromCityId, toCityId).catch(() => null),
          fetchNearbyDates({
            type: f.type,
            fromCityId,
            toCityId,
            date: f.dateFrom || new Date().toISOString().slice(0, 10),
          }).catch(() => []),
        ]);
        setDemandCount(count);
        setNearbyDates(dates);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(filters);
    router.replace(`/?${filtersToSearch(filters)}`, { scroll: false });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // см. выше
    }
  }, [filters]);

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const [fromCityId, toCityId] = await Promise.all([
        filters.fromCity ? resolveCityId(filters.fromCity) : Promise.resolve(undefined),
        filters.toCity ? resolveCityId(filters.toCity) : Promise.resolve(undefined),
      ]);
      const page = await fetchListingsPage({
        type: filters.type,
        fromCityId: fromCityId ?? undefined,
        toCityId: toCityId ?? undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        weightMinKg: filters.weightMinKg ? Number(filters.weightMinKg) : undefined,
        priceMaxPerKg:
          filters.priceMaxPerKg && filters.currencyCode ? Number(filters.priceMaxPerKg) : undefined,
        currencyCode: filters.currencyCode || undefined,
        verifiedOnly: filters.verifiedOnly,
        sortBy: filters.sortBy,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setListings((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleSubscribe() {
    setSubscribeStatus("saving");
    try {
      const [fromCityId, toCityId] = await Promise.all([
        resolveCityId(filters.fromCity),
        resolveCityId(filters.toCity),
      ]);
      if (!fromCityId || !toCityId) return;
      await createSubscription({ fromCityId, toCityId, listingType: filters.type });
      setSubscribeStatus("done");
    } catch {
      setSubscribeStatus("idle");
    }
  }

  const priceSortAvailable = Boolean(pending.currencyCode);

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
                value={pending.fromCity}
                onChange={(v) => setPending((p) => ({ ...p, fromCity: v }))}
              />
            </div>
            <div className="min-w-0 flex-1 border-b border-border px-4 py-2.5 sm:border-r sm:border-b-0">
              <CityPicker
                label={dictionary.createListing.toLabel}
                placeholder={dictionary.feed.anyCity}
                value={pending.toCity}
                onChange={(v) => setPending((p) => ({ ...p, toCity: v }))}
              />
            </div>
            <div className="min-w-0 flex-1 px-4 py-2.5">
              <span className="block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                {dictionary.feed.dateLabel}
              </span>
              <input
                type="date"
                value={pending.dateFrom}
                onChange={(e) => setPending((p) => ({ ...p, dateFrom: e.target.value }))}
                className="w-full truncate bg-transparent text-sm font-semibold text-foreground outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilters(pending)}
              className="m-1 shrink-0 rounded-sm bg-action px-6 font-heading text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
            >
              {dictionary.feed.searchCta}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="mt-3 text-xs font-semibold text-foreground/70 underline decoration-dotted underline-offset-2"
        >
          {dictionary.feed.filtersCta}
        </button>

        {showFilters ? (
          <div className="mx-auto mt-3 max-w-3xl rounded-lg bg-card p-4 text-left shadow-lg">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  {dictionary.feed.dateToLabel}
                </span>
                <input
                  type="date"
                  value={pending.dateTo}
                  onChange={(e) => setPending((p) => ({ ...p, dateTo: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  {dictionary.feed.weightMinLabel}
                </span>
                <input
                  type="number"
                  min={0}
                  value={pending.weightMinKg}
                  onChange={(e) => setPending((p) => ({ ...p, weightMinKg: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  {dictionary.feed.currencyLabel}
                </span>
                <select
                  value={pending.currencyCode}
                  onChange={(e) => setPending((p) => ({ ...p, currencyCode: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">{dictionary.feed.currencyAny}</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  {dictionary.feed.priceMaxLabel}
                </span>
                <input
                  type="number"
                  min={0}
                  disabled={!pending.currencyCode}
                  value={pending.priceMaxPerKg}
                  onChange={(e) => setPending((p) => ({ ...p, priceMaxPerKg: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={pending.verifiedOnly}
                  onChange={(e) => setPending((p) => ({ ...p, verifiedOnly: e.target.checked }))}
                />
                {dictionary.feed.verifiedOnlyLabel}
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground">
                {dictionary.feed.sortLabel}
                <select
                  value={pending.sortBy}
                  onChange={(e) => setPending((p) => ({ ...p, sortBy: e.target.value as ListingSort }))}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="date">{dictionary.feed.sortByDate}</option>
                  <option value="price" disabled={!priceSortAvailable}>
                    {dictionary.feed.sortByPrice}
                  </option>
                  <option value="rating">{dictionary.feed.sortByRating}</option>
                </select>
              </label>
            </div>
            {!priceSortAvailable ? (
              <p className="mt-2 text-xs text-muted-foreground">{dictionary.feed.sortPriceDisabledHint}</p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPending(DEFAULT_FILTERS);
                  setFilters(DEFAULT_FILTERS);
                }}
                className="font-heading flex-1 rounded-sm border border-border py-2 text-xs font-bold text-foreground"
              >
                {dictionary.feed.resetFiltersCta}
              </button>
              <button
                type="button"
                onClick={() => setFilters(pending)}
                className="font-heading flex-1 rounded-sm bg-action py-2 text-xs font-bold text-on-action"
              >
                {dictionary.feed.applyFiltersCta}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-extrabold text-foreground">
          {dictionary.feed.resultsTitle}
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            {dictionary.feed.foundCount(listings.length)}
          </span>
        </h2>
        <div className="inline-flex rounded-sm border border-border p-0.5">
          <button
            type="button"
            onClick={() => {
              const next = { ...filters, type: "trip" as const };
              setPending(next);
              setFilters(next);
            }}
            className={`font-heading rounded-sm px-3 py-1 text-sm font-bold transition-colors ${
              filters.type === "trip" ? "bg-primary text-on-primary" : "text-muted-foreground"
            }`}
          >
            {dictionary.feed.tripsTab}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = { ...filters, type: "request" as const };
              setPending(next);
              setFilters(next);
            }}
            className={`font-heading rounded-sm px-3 py-1 text-sm font-bold transition-colors ${
              filters.type === "request" ? "bg-primary text-on-primary" : "text-muted-foreground"
            }`}
          >
            {dictionary.feed.requestsTab}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-md border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">{dictionary.feed.loading}</p>
        </div>
      ) : hasError ? (
        <div className="mt-4 rounded-md border border-border bg-card px-4 py-10 text-center">
          <p className="font-medium text-foreground">{dictionary.feed.errorTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{dictionary.feed.errorHint}</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-8 text-center">
          <p className="font-medium text-foreground">{dictionary.feed.emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{dictionary.feed.emptyHint}</p>

          {demandCount !== null ? (
            <p className="font-heading text-sm font-bold text-primary">
              {dictionary.feed.demandCount(demandCount)}
            </p>
          ) : null}

          {nearbyDates.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                {dictionary.feed.nearbyDatesTitle}
              </p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                {nearbyDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, dateFrom: date, dateTo: "" }))}
                    className="rounded-sm border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    {date}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {filters.fromCity && filters.toCity ? (
            <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={subscribeStatus !== "idle"}
                className="font-heading rounded-sm border border-border px-4 py-2 text-sm font-bold text-foreground disabled:opacity-60"
              >
                {subscribeStatus === "done"
                  ? dictionary.profile.subscriptionCreated
                  : dictionary.profile.addSubscriptionCta}
              </button>
              <Link
                href={session.status === "signedIn" ? "/listings/new" : "/login"}
                className="font-heading rounded-sm bg-action px-4 py-2 text-sm font-bold text-on-action"
              >
                {filters.type === "trip"
                  ? dictionary.feed.postCounterCtaRequest
                  : dictionary.feed.postCounterCtaTrip}
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          {nextCursor ? (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="font-heading rounded-sm border border-border px-6 py-2.5 text-sm font-bold text-foreground disabled:opacity-60"
              >
                {isLoadingMore ? dictionary.feed.loadingMore : dictionary.feed.loadMoreCta}
              </button>
            </div>
          ) : null}
        </>
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
