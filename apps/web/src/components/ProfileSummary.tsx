import { dictionary } from "@/lib/dictionary";
import type { PublicProfile } from "@/lib/profile";
import { initials } from "@/lib/initials";
import { Avatar } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { RatingStars } from "./RatingStars";

function DealsFactCard({
  label,
  rating,
  ratingCount,
  dealsCount,
}: {
  label: string;
  rating: number | null;
  ratingCount: number;
  dealsCount: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 text-center shadow-sm">
      {/* ТЗ E11 п.11.12 — без опубликованных отзывов нет ни рейтинга, ни
          пустых звёзд: то и другое читалось бы как плохая оценка. */}
      {rating === null ? (
        <p className="font-heading text-sm font-bold text-muted-foreground">
          {dictionary.review.noRatingsYet}
        </p>
      ) : (
        <>
          <div className="flex justify-center">
            <RatingStars value={rating} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{dictionary.review.ratingCount(ratingCount)}</p>
        </>
      )}
      {dealsCount > 0 ? (
        <p className="font-heading mt-1 text-lg font-bold text-foreground">{dealsCount}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Блок «личность + показатели» — общий для публичного профиля и своего
 * (E06 п. 6.1). Рейтинг и число сделок раздельно по ролям курьера и
 * заказчика (6.2); пока сделок нет — «пока нет сделок» вместо нулевых
 * звёзд (6.3). Частые маршруты и рейтинг всегда пусты до E10/E11.
 */
export function ProfileSummary({ profile }: { profile: PublicProfile }) {
  const hasAnyDeals = profile.courierDealsCount > 0 || profile.customerDealsCount > 0;

  return (
    <div>
      <div className="flex items-center gap-4 rounded-md border border-border bg-card p-4 shadow-sm">
        <Avatar
          initials={initials(profile.displayName ?? "?")}
          imageUrl={profile.avatarUrl}
          verified={profile.verificationStatus === "approved"}
          size="lg"
        />
        <div>
          <p className="font-heading text-lg font-semibold text-card-foreground">
            {profile.displayName ?? dictionary.profile.genericUserName}
          </p>
          {profile.city ? <p className="text-sm text-muted-foreground">{profile.city}</p> : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {profile.verificationStatus === "approved" ? (
              <VerifiedBadge />
            ) : (
              <span className="text-xs text-muted-foreground">{dictionary.profile.unverified}</span>
            )}
            {!hasAnyDeals ? (
              <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {dictionary.profile.newMemberBadge}
              </span>
            ) : null}
          </div>
          {profile.referredCount > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {dictionary.profile.referredCount(profile.referredCount)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <DealsFactCard
          label={dictionary.profile.dealsAsCourier}
          rating={profile.courierRating}
          ratingCount={profile.courierRatingCount}
          dealsCount={profile.courierDealsCount}
        />
        <DealsFactCard
          label={dictionary.profile.dealsAsCustomer}
          rating={profile.customerRating}
          ratingCount={profile.customerRatingCount}
          dealsCount={profile.customerDealsCount}
        />
      </div>

      {profile.frequentRoutes.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {dictionary.profile.frequentRoutesTitle}
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.frequentRoutes.map((route) => (
              <span
                key={route}
                className="rounded-sm border border-border bg-card px-3 py-1.5 text-sm text-foreground"
              >
                {route}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {profile.aboutText ? (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {dictionary.profile.aboutTitle}
          </p>
          <p className="text-sm text-foreground">{profile.aboutText}</p>
        </div>
      ) : null}
    </div>
  );
}
