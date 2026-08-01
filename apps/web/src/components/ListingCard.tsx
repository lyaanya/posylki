import Link from "next/link";
import type { Listing } from "@/lib/mock-data";
import { dictionary } from "@/lib/dictionary";
import { Avatar } from "./Avatar";
import { RatingStars } from "./RatingStars";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="block rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-heading text-base font-semibold text-card-foreground">
            {listing.fromCity} → {listing.toCity}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {listing.dateFrom} – {listing.dateTo}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="font-heading text-base font-semibold whitespace-nowrap text-primary">
            {listing.pricePerKg} {listing.currency}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {dictionary.feed.pricePerKg}
            </span>
          </p>
          <p className="text-xs whitespace-nowrap text-muted-foreground">
            {dictionary.feed.minPrice} {listing.minPrice} {listing.currency}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Avatar
            initials={listing.courier.initials}
            verified={listing.courier.verified}
            size="sm"
          />
          <div>
            <p className="text-sm font-medium text-card-foreground">{listing.courier.name}</p>
            <RatingStars value={listing.courier.rating} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {dictionary.feed.freeWeight} {listing.freeWeightKg} кг
        </p>
      </div>
    </Link>
  );
}
