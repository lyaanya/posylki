"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dictionary } from "@/lib/dictionary";
import { currentUser } from "@/lib/mock-data";
import { fetchMyListings, type Listing } from "@/lib/listings";
import { formatDate } from "@/lib/format-date";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { Avatar } from "@/components/Avatar";
import { RatingStars } from "@/components/RatingStars";
import { VerifiedBadge } from "@/components/VerifiedBadge";

/**
 * Имя, город, рейтинг и отзывы — пока моки: у E06 (профиль) и E11 (отзывы)
 * ещё нет бэкенда. «Мои объявления» ниже — уже реальные данные (E07,
 * демо-срез), поэтому получены отдельно, не из currentUser.
 */
export default function ProfilePage() {
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setIsSignedIn(session != null);
      if (!session) return;
      fetchMyListings().then((listings) => {
        if (!cancelled) setMyListings(listings);
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
          {dictionary.profile.myListingsTitle}
        </p>
        {isSignedIn === null ? (
          <p className="text-sm text-muted-foreground">{dictionary.profile.myListingsLoading}</p>
        ) : !isSignedIn ? (
          <p className="text-sm text-muted-foreground">{dictionary.profile.myListingsSignInHint}</p>
        ) : myListings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dictionary.profile.myListingsEmpty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/40"
              >
                <div>
                  <p className="font-heading text-sm font-bold text-card-foreground">
                    {listing.fromCity} → {listing.toCity}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(listing.date)}</p>
                </div>
                <p className="font-heading text-sm font-bold text-card-foreground">
                  {listing.pricePerKg} {listing.currency}
                </p>
              </Link>
            ))}
          </div>
        )}
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
