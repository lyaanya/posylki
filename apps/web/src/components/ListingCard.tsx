import Link from "next/link";
import type { Listing } from "@/lib/mock-data";
import { dictionary } from "@/lib/dictionary";
import { Avatar } from "./Avatar";

export function ListingCard({ listing, rank }: { listing: Listing; rank: number }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="flex items-center gap-4 border-b border-border px-4 py-3.5 transition-colors last:border-none hover:bg-muted/60"
    >
      <span className="w-5 shrink-0 text-center font-heading text-sm font-extrabold text-muted-foreground">
        {rank}
      </span>
      <Avatar initials={listing.courier.initials} verified={listing.courier.verified} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-card-foreground">
          {listing.courier.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {listing.fromCity} → {listing.toCity} · {dictionary.feed.freeWeight}{" "}
          {listing.freeWeightKg} кг
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-sm font-bold text-foreground">
          {listing.pricePerKg} {listing.currency}
        </p>
        <p className="text-xs text-muted-foreground">
          ★ {listing.courier.rating.toFixed(1).replace(".", ",")} · {listing.courier.dealsCount}
        </p>
      </div>
    </Link>
  );
}
