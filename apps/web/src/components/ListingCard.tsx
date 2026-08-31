import Link from "next/link";
import type { Listing } from "@/lib/listings";
import { dictionary } from "@/lib/dictionary";
import { formatDate } from "@/lib/format-date";

function RouteArrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="mx-1.5 shrink-0 text-action opacity-70"
      aria-hidden="true"
    >
      <path
        d="M3 12h15m0 0l-5-5m5 5l-5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-xs font-semibold ${
            listing.courier.verified
              ? "bg-verified-bg text-verified-fg"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {listing.courier.verified ? `✓ ${dictionary.common.trustedBadge}` : dictionary.profile.pending}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-heading text-base font-extrabold text-card-foreground">
          {listing.fromCity}
        </span>
        <RouteArrow />
        <span className="font-heading text-base font-extrabold text-card-foreground">
          {listing.toCity}
        </span>
      </div>

      <div className="flex justify-between border-y border-border/70 py-2.5">
        <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {dictionary.listing.datesLabel}
          <span className="mt-0.5 block text-[13px] font-semibold text-foreground normal-case">
            {formatDate(listing.dateFrom)}
          </span>
        </div>
        <div className="text-right text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {dictionary.feed.freeWeight}
          <span className="mt-0.5 block text-[13px] font-semibold text-foreground normal-case">
            {listing.weightKg} кг
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {listing.pricePerKg !== null ? (
            <>
              <span className="font-heading block text-lg font-extrabold text-card-foreground">
                {listing.pricePerKg} {listing.currency}
              </span>
              {listing.minPrice !== null ? (
                <span className="text-[11px] text-muted-foreground">
                  {dictionary.feed.minPrice} {listing.minPrice} {listing.currency}
                </span>
              ) : null}
            </>
          ) : listing.priceTotal !== null ? (
            <span className="font-heading block text-lg font-extrabold text-card-foreground">
              {listing.priceTotal} {listing.currency}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{dictionary.feed.priceNotSpecified}</span>
          )}
        </div>
        <span className="font-heading shrink-0 rounded-sm bg-action px-4 py-1.5 text-sm font-bold text-nowrap text-on-action">
          {listing.type === "trip" ? dictionary.listing.respondCta : dictionary.listing.offerCta}
        </span>
      </div>

      <div className="flex items-center gap-2.5 border-t border-border/70 pt-3">
        {listing.courier.avatarUrl ? (
          <img
            src={listing.courier.avatarUrl}
            alt=""
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
            {listing.courier.initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{listing.courier.name}</p>
          <p className="text-[11px] text-muted-foreground">
            ★ {listing.courier.rating.toFixed(1).replace(".", ",")} ·{" "}
            {dictionary.listing.dealsCount(listing.courier.dealsCount)}
          </p>
        </div>
      </div>
    </Link>
  );
}
