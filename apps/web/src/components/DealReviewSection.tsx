"use client";

import { useEffect, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import {
  ReviewApiError,
  createReview,
  fetchReviewsByDeal,
  type Review,
} from "@/lib/reviews";
import { RatingStars } from "@/components/RatingStars";

function errorMessage(err: unknown): string {
  if (err instanceof ReviewApiError) {
    const map: Record<string, string> = {
      REVIEW_WINDOW_EXPIRED: dictionary.review.windowExpiredError,
      REVIEW_ALREADY_EXISTS: dictionary.review.alreadyExistsError,
      DEAL_NOT_COMPLETED: dictionary.review.dealNotCompletedError,
    };
    return map[err.code] ?? err.message ?? dictionary.review.genericError;
  }
  return dictionary.review.genericError;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} из 5`}
          className="text-2xl leading-none"
          style={{ color: n <= value ? "var(--color-warning)" : "var(--color-border)" }}
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

function ReadonlyReviewCard({ review, title }: { review: Review; title: string }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-muted-foreground">{title}</p>
      {review.rating !== null ? <RatingStars value={review.rating} /> : null}
      {review.text ? <p className="mt-1.5 text-sm text-foreground">{review.text}</p> : null}
    </div>
  );
}

/** ТЗ E11 п.11.1-11.6 — только по завершённой сделке, слепая публикация. */
export function DealReviewSection({ dealId }: { dealId: string }) {
  const [data, setData] = useState<{ mine: Review | null; theirs: Review | null } | null>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReviewsByDeal(dealId).then(setData);
  }, [dealId]);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await createReview({ dealId, rating, text: text.trim() || undefined });
      const fresh = await fetchReviewsByDeal(dealId);
      setData(fresh);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  return (
    <div className="mt-4 rounded-md border border-border bg-card p-4 shadow-sm">
      <p className="mb-3 text-sm font-medium text-muted-foreground">{dictionary.review.title}</p>

      {data.mine ? (
        <ReadonlyReviewCard review={data.mine} title={dictionary.review.alreadyLeft} />
      ) : (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{dictionary.review.leaveTitle}</p>
          <div className="mb-3">
            <p className="mb-1 text-xs text-muted-foreground">{dictionary.review.ratingLabel}</p>
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <textarea
            rows={3}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={dictionary.review.textPlaceholder}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="font-heading mt-3 w-full rounded-sm bg-action py-2.5 text-sm font-bold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
          >
            {busy ? dictionary.review.submitting : dictionary.review.submitCta}
          </button>
        </div>
      )}

      {data.mine && !data.mine.publishedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">{dictionary.review.waitingForOtherSide}</p>
      ) : null}

      {data.theirs ? (
        <div className="mt-4 border-t border-border pt-4">
          <ReadonlyReviewCard review={data.theirs} title={dictionary.review.theirReview} />
        </div>
      ) : null}
    </div>
  );
}
