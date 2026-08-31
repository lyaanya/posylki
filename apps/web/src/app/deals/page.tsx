"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dictionary } from "@/lib/dictionary";
import { useSession } from "@/lib/auth";
import { fetchMyDeals, type Deal } from "@/lib/deals";
import { fetchMyProfile } from "@/lib/profile";
import { Avatar } from "@/components/Avatar";

export default function MyDealsPage() {
  const session = useSession();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    if (session.status !== "signedIn") return;
    let cancelled = false;
    Promise.all([fetchMyDeals(), fetchMyProfile()]).then(([items, profile]) => {
      if (cancelled) return;
      setDeals(items);
      setMyId(profile.id);
    });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  if (session.status === "loading") return null;
  if (session.status === "signedOut") {
    return (
      <div className="py-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{dictionary.deal.myDealsTitle}</h1>
        <div className="mt-5 rounded-md border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{dictionary.deal.signInHint}</p>
          <Link
            href="/login"
            className="font-heading mt-4 inline-block rounded-sm bg-action px-5 py-2.5 text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
          >
            {dictionary.auth.signInCta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">{dictionary.deal.myDealsTitle}</h1>
      <div className="mt-5">
        {deals === null ? (
          <p className="text-sm text-muted-foreground">{dictionary.chat.loading}</p>
        ) : deals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dictionary.deal.myDealsEmpty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deals.map((deal) => {
              const counterpart = deal.customer.id === myId ? deal.courier : deal.customer;
              return (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-card p-3.5 shadow-sm"
                >
                  <Avatar initials={counterpart.initials} imageUrl={counterpart.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading truncate text-sm font-bold text-card-foreground">
                      {deal.fromCity} → {deal.toCity}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{dictionary.deal.statusLabels[deal.status]}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
