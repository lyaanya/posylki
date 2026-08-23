import { notFound } from "next/navigation";
import { listings } from "@/lib/mock-data";
import { dictionary } from "@/lib/dictionary";
import { Avatar } from "@/components/Avatar";
import { RatingStars } from "@/components/RatingStars";
import { VerifiedBadge } from "@/components/VerifiedBadge";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-none">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = listings.find((item) => item.id === id);

  if (!listing) {
    notFound();
  }

  return (
    <div className="py-6">
      <p className="text-sm font-medium text-muted-foreground">
        {listing.type === "trip" ? dictionary.feed.tripsTab : dictionary.feed.requestsTab}
      </p>
      <h1 className="mt-1 font-heading text-2xl font-bold text-foreground">
        {listing.fromCity} → {listing.toCity}
      </h1>

      <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
        <InfoRow
          label={dictionary.listing.datesLabel}
          value={`${listing.dateFrom} – ${listing.dateTo}`}
        />
        <InfoRow label={dictionary.listing.freeWeightLabel} value={`${listing.freeWeightKg} кг`} />
        <InfoRow
          label={dictionary.listing.priceLabel}
          value={`${listing.pricePerKg} ${listing.currency} / кг, ${dictionary.feed.minPrice} ${listing.minPrice} ${listing.currency}`}
        />
        <InfoRow label={dictionary.listing.storageLabel} value={`${listing.storageDays} дня`} />
      </div>

      <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          {dictionary.listing.courierLabel}
        </p>
        <div className="flex items-center gap-3">
          <Avatar
            initials={listing.courier.initials}
            verified={listing.courier.verified}
            size="lg"
          />
          <div>
            <p className="font-heading text-base font-semibold text-card-foreground">
              {listing.courier.name}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <RatingStars value={listing.courier.rating} />
              <span className="text-sm text-muted-foreground">
                · {dictionary.listing.dealsCount(listing.courier.dealsCount)}
              </span>
            </div>
            <div className="mt-2">
              {listing.courier.verified ? (
                <VerifiedBadge />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {dictionary.profile.unverified}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="font-heading mt-6 w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
      >
        {dictionary.listing.respondCta}
      </button>
    </div>
  );
}
