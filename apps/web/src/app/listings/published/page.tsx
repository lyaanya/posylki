"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dictionary } from "@/lib/dictionary";
import { loadPublishedListing, type ListingDraftFields } from "@/lib/listing-draft";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#F1EAE4] py-2.5 last:border-none">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

/**
 * Экран после «опубликовать» на черновике — объявление уже реально
 * сохранено (draft/page.tsx вызывает apps/api перед переходом сюда).
 * Дальше — в ленту, это самое естественное продолжение: там курьер сразу
 * видит, как объявление выглядит среди остальных.
 */
export default function ListingPublishedPage() {
  const [listing, setListing] = useState<ListingDraftFields | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setListing(loadPublishedListing());
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  if (!listing) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{dictionary.createListing.publishedNotFound}</p>
        <Link
          href="/listings/new"
          className="mt-3 inline-block text-sm font-semibold text-primary underline decoration-dotted underline-offset-2"
        >
          {dictionary.createListing.publishedCreateCta}
        </Link>
      </div>
    );
  }

  const currency = "₽";

  return (
    <div className="py-10 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary text-on-primary">
        <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M4 10.5l3.5 3.5L16 5.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h1 className="font-heading mt-4 text-2xl font-bold text-foreground">
        {dictionary.createListing.publishedTitle}
      </h1>
      <p className="mx-auto mt-1 max-w-[42ch] text-sm text-muted-foreground">
        {dictionary.createListing.publishedNote}
      </p>

      <div className="mt-6 rounded-md border border-border bg-card p-4 text-left shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-heading text-lg font-extrabold text-card-foreground">
            {listing.fromCity} → {listing.toCity}
          </span>
          <span className="rounded-sm bg-verified-bg px-2.5 py-1 text-xs font-semibold text-verified-fg">
            {listing.type === "trip" ? dictionary.createListing.typeTrip : dictionary.createListing.typeRequest}
          </span>
        </div>
        <div className="mt-3">
          <SummaryRow label={dictionary.createListing.dateLabel} value={listing.date} />
          <SummaryRow label={dictionary.createListing.weightLabel} value={`${listing.weightKg} кг`} />
          <SummaryRow
            label={dictionary.createListing.priceStepLabel}
            value={`${listing.pricePerKg} ${currency}`}
          />
          <SummaryRow
            label={dictionary.createListing.minPriceStepLabel}
            value={`${listing.minPrice} ${currency}`}
          />
          {listing.description ? (
            <div className="pt-2.5">
              <span className="block text-sm text-muted-foreground">
                {dictionary.createListing.descriptionStepTitle}
              </span>
              <p className="mt-1 text-sm text-foreground">{listing.description}</p>
            </div>
          ) : null}
        </div>
      </div>

      {listing.id ? (
        <Link
          href={`/listings/${listing.id}`}
          className="font-heading mt-6 block w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
        >
          {dictionary.createListing.publishedViewCta}
        </Link>
      ) : null}
      <Link
        href="/"
        className={
          listing.id
            ? "mt-3 block text-sm font-semibold text-primary underline decoration-dotted underline-offset-2"
            : "font-heading mt-6 block w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
        }
      >
        {dictionary.createListing.publishedGoToFeed}
      </Link>
      <Link
        href="/profile"
        className="mt-3 block text-sm font-semibold text-primary underline decoration-dotted underline-offset-2"
      >
        {dictionary.createListing.publishedGoToProfile}
      </Link>
    </div>
  );
}
