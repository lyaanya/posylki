import Link from "next/link";
import { notFound } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { fetchPublicProfile } from "@/lib/profile";
import { fetchListings } from "@/lib/listings";
import { formatDate } from "@/lib/format-date";
import { ProfileSummary } from "@/components/ProfileSummary";
import { ReviewsSection } from "@/components/ReviewsSection";
import { ComplaintButton } from "@/components/ComplaintButton";

/**
 * Публичный профиль (E06 п. 6.1) — доступен по ссылке гостю без входа.
 * Заблокированный (6.6) и удалённый (6.7) пользователь отдают отдельные
 * нейтральные экраны без подробностей вместо карточки профиля.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await fetchPublicProfile(id);

  if (!view) {
    notFound();
  }

  if (view.status === "blocked") {
    return (
      <div className="py-6">
        <div className="rounded-md border border-border bg-card p-5 text-center shadow-sm">
          <p className="font-heading text-lg font-bold text-foreground">
            {dictionary.publicProfile.blockedTitle}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{dictionary.publicProfile.blockedText}</p>
        </div>
      </div>
    );
  }

  if (view.status === "deleted") {
    return (
      <div className="py-6">
        <div className="rounded-md border border-border bg-card p-5 text-center shadow-sm">
          <p className="font-heading text-lg font-bold text-foreground">
            {dictionary.publicProfile.deletedTitle}
          </p>
        </div>
      </div>
    );
  }

  const { status: _status, ...profile } = view;
  const activeListings = await fetchListings({ ownerId: id });

  return (
    <div className="py-6">
      <ProfileSummary profile={profile} />
      <div className="mt-3 flex justify-end">
        <ComplaintButton targetType="user" targetId={id} />
      </div>
      <ReviewsSection userId={id} />

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {dictionary.publicProfile.activeListingsTitle}
        </p>
        {activeListings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dictionary.publicProfile.noActiveListings}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/40"
              >
                <div>
                  <p className="font-heading text-sm font-bold text-card-foreground">
                    {listing.fromCity} → {listing.toCity}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(listing.dateFrom)}</p>
                </div>
                <p className="font-heading text-sm font-bold text-card-foreground">
                  {listing.pricePerKg ?? listing.priceTotal ?? "—"} {listing.currency}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
