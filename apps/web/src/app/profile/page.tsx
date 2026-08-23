import { dictionary } from "@/lib/dictionary";
import { currentUser } from "@/lib/mock-data";
import { Avatar } from "@/components/Avatar";
import { RatingStars } from "@/components/RatingStars";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export default function ProfilePage() {
  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        {dictionary.profile.title}
      </h1>

      <div className="mt-5 flex items-center gap-4 rounded-md border border-border bg-card p-4 shadow-sm">
        <Avatar initials={currentUser.initials} verified={currentUser.verified} size="lg" />
        <div>
          <p className="font-heading text-lg font-semibold text-card-foreground">
            {currentUser.name}
          </p>
          <p className="text-sm text-muted-foreground">{currentUser.city}</p>
          <div className="mt-1.5">
            {currentUser.verified ? (
              <VerifiedBadge />
            ) : (
              <span className="text-xs text-muted-foreground">{dictionary.profile.pending}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-card p-4 text-center shadow-sm">
          <p className="font-heading text-2xl font-bold text-foreground">
            {currentUser.dealsCount}
          </p>
          <p className="text-sm text-muted-foreground">{dictionary.profile.dealsLabel}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4 text-center shadow-sm">
          <div className="flex justify-center">
            <RatingStars value={currentUser.rating} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{dictionary.profile.ratingLabel}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {dictionary.profile.routesTitle}
        </p>
        <div className="flex flex-wrap gap-2">
          {currentUser.frequentRoutes.map((route) => (
            <span
              key={route}
              className="rounded-sm border border-border bg-card px-3 py-1.5 text-sm text-foreground"
            >
              {route}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {dictionary.profile.reviewsTitle}
        </p>
        <div className="flex flex-col gap-3">
          {currentUser.reviews.map((review, i) => (
            <div key={i} className="rounded-md border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-card-foreground">{review.author}</p>
                <RatingStars value={review.rating} />
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{review.text}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="font-heading mt-6 w-full rounded-sm border border-border py-3 text-sm font-bold text-foreground"
      >
        {dictionary.profile.editCta}
      </button>
    </div>
  );
}
