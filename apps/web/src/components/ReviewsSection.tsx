"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dictionary } from "@/lib/dictionary";
import { fetchReviewsForUser, type Review } from "@/lib/reviews";
import { formatDate } from "@/lib/format-date";
import { Avatar } from "@/components/Avatar";
import { RatingStars } from "@/components/RatingStars";
import { ComplaintButton } from "@/components/ComplaintButton";

const EXCERPT_LIMIT = 5;

function ReviewCard({ review }: { review: Review }) {
  const roleLabel = review.role === "as_courier" ? dictionary.review.asCourierLabel : dictionary.review.asCustomerLabel;

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        {review.author.isDeleted ? (
          <div className="flex items-center gap-2.5">
            <Avatar initials="?" imageUrl={null} />
            <p className="font-heading text-sm font-bold text-muted-foreground">{review.author.name}</p>
          </div>
        ) : (
          <Link href={`/profile/${review.author.id}`} className="flex items-center gap-2.5">
            <Avatar initials={review.author.initials} imageUrl={review.author.avatarUrl} />
            <p className="font-heading text-sm font-bold text-card-foreground">{review.author.name}</p>
          </Link>
        )}
        {review.rating !== null ? <RatingStars value={review.rating} /> : null}
      </div>
      {review.text ? <p className="mt-2.5 text-sm text-foreground">{review.text}</p> : null}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {roleLabel} · {review.fromCity} → {review.toCity} · {formatDate(review.createdAt.slice(0, 10))}
        </p>
        <ComplaintButton
          targetType="review"
          targetId={review.id}
          className="shrink-0 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-destructive"
        />
      </div>
    </div>
  );
}

/** ТЗ E11 п.11.18-11.19 — последние пять отзывов в профиле, с возможностью открыть полный список. */
export function ReviewsSection({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    fetchReviewsForUser(userId, EXCERPT_LIMIT).then((page) => {
      setReviews(page.items);
      setNextCursor(page.nextCursor);
    });
  }, [userId]);

  async function handleSeeAll() {
    setIsExpanded(true);
    if (!nextCursor) return;
    setIsLoadingMore(true);
    const page = await fetchReviewsForUser(userId, 20, nextCursor);
    setReviews((prev) => [...(prev ?? []), ...page.items]);
    setNextCursor(page.nextCursor);
    setIsLoadingMore(false);
  }

  async function handleLoadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    const page = await fetchReviewsForUser(userId, 20, nextCursor);
    setReviews((prev) => [...(prev ?? []), ...page.items]);
    setNextCursor(page.nextCursor);
    setIsLoadingMore(false);
  }

  if (reviews === null) return null;

  return (
    <div className="mt-6">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{dictionary.review.title}</p>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dictionary.review.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {!isExpanded && nextCursor ? (
        <button
          type="button"
          onClick={handleSeeAll}
          className="font-heading mt-3 w-full rounded-sm border border-border py-2.5 text-sm font-bold text-foreground"
        >
          {dictionary.review.seeAllCta}
        </button>
      ) : null}
      {isExpanded && nextCursor ? (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className="font-heading mt-3 w-full rounded-sm border border-border py-2.5 text-sm font-bold text-foreground disabled:opacity-50"
        >
          {dictionary.review.loadMoreCta}
        </button>
      ) : null}
    </div>
  );
}
