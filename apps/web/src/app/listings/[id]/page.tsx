import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchListing } from "@/lib/listings";
import { dictionary } from "@/lib/dictionary";
import { formatDate } from "@/lib/format-date";
import { Avatar } from "@/components/Avatar";
import { RatingStars } from "@/components/RatingStars";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ComplaintButton } from "@/components/ComplaintButton";

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
  const listing = await fetchListing(id);

  if (!listing) {
    notFound();
  }

  const isTrip = listing.type === "trip";
  const dateValue =
    listing.dateFrom === listing.dateTo
      ? formatDate(listing.dateFrom)
      : `${formatDate(listing.dateFrom)} — ${formatDate(listing.dateTo)}`;

  return (
    <div className="py-6">
      <p className="text-sm font-medium text-muted-foreground">
        {isTrip ? dictionary.feed.tripsTab : dictionary.feed.requestsTab}
        {listing.status === "hidden_by_author" ? ` · ${dictionary.listing.statusHidden}` : null}
        {listing.status === "archived" ? ` · ${dictionary.listing.statusArchived}` : null}
      </p>
      <h1 className="mt-1 font-heading text-2xl font-bold text-foreground">
        {listing.fromCity} → {listing.toCity}
      </h1>

      <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
        <InfoRow
          label={isTrip ? dictionary.listing.datesLabel : dictionary.listing.dateRangeLabel}
          value={dateValue}
        />
        <InfoRow
          label={isTrip ? dictionary.listing.freeWeightLabel : dictionary.listing.weightLabel}
          value={`${listing.weightKg} кг`}
        />
        {listing.pricePerKg !== null ? (
          <InfoRow
            label={dictionary.listing.priceLabel}
            value={
              listing.minPrice !== null
                ? `${listing.pricePerKg} ${listing.currency} / кг, ${dictionary.feed.minPrice} ${listing.minPrice} ${listing.currency}`
                : `${listing.pricePerKg} ${listing.currency} / кг`
            }
          />
        ) : null}
        {listing.priceTotal !== null ? (
          <InfoRow
            label={dictionary.listing.priceTotalLabel}
            value={`${listing.priceTotal} ${listing.currency}`}
          />
        ) : null}
        {isTrip && listing.storageUntilDate ? (
          <InfoRow label={dictionary.listing.storageUntilLabel} value={formatDate(listing.storageUntilDate)} />
        ) : null}
      </div>

      {listing.itemDescription ? (
        <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">{dictionary.listing.itemDescriptionLabel}</p>
          <p className="mt-1.5 text-sm text-foreground">{listing.itemDescription}</p>
        </div>
      ) : null}

      {isTrip && (listing.pickupInstructions || listing.dropoffInstructions) ? (
        <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
          {listing.pickupInstructions ? (
            <div>
              <p className="text-sm text-muted-foreground">{dictionary.listing.pickupInstructionsLabel}</p>
              <p className="mt-1.5 text-sm text-foreground">{listing.pickupInstructions}</p>
            </div>
          ) : null}
          {listing.dropoffInstructions ? (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">{dictionary.listing.dropoffInstructionsLabel}</p>
              <p className="mt-1.5 text-sm text-foreground">{listing.dropoffInstructions}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {isTrip && (listing.departureAirport || listing.arrivalAirport || listing.flightNumber) ? (
        <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
          <p className="mb-1.5 text-sm text-muted-foreground">{dictionary.listing.flightInfoLabel}</p>
          <p className="text-sm text-foreground">
            {[listing.departureAirport, listing.arrivalAirport, listing.flightNumber]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {listing.comment ? (
        <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">{dictionary.listing.commentLabel}</p>
          <p className="mt-1.5 text-sm text-foreground">{listing.comment}</p>
        </div>
      ) : null}

      <div className="mt-5 rounded-md border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {isTrip ? dictionary.listing.courierLabel : dictionary.listing.ownerLabel}
          </p>
          <ComplaintButton targetType="listing" targetId={listing.id} />
        </div>
        <Link href={`/profile/${listing.courier.id}`} className="flex items-center gap-3">
          <Avatar
            initials={listing.courier.initials}
            imageUrl={listing.courier.avatarUrl}
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
        </Link>
      </div>

      <Link
        href={`/chat/listing/${listing.id}`}
        className="font-heading mt-6 block w-full rounded-sm bg-action py-3 text-center text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
      >
        {isTrip ? dictionary.listing.respondCta : dictionary.listing.offerCta}
      </Link>
    </div>
  );
}
