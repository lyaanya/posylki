"use client";

import { useEffect, useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { CityPicker } from "@/components/CityPicker";
import { resolveCityId } from "@/lib/directories";
import {
  createSubscription,
  deleteSubscription,
  fetchMySubscriptions,
  setSubscriptionActive,
  type RouteSubscription,
} from "@/lib/subscriptions";

/**
 * ТЗ E08 п.8.10, 8.13 — подписка на маршрут, видна в профиле, можно
 * отключить и удалить. Уведомления (E14) не входят — только накопление
 * совпадений (matchCount), см. apps/api/src/subscriptions.
 */
export function SubscriptionsSection() {
  const [subscriptions, setSubscriptions] = useState<RouteSubscription[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMySubscriptions().then(setSubscriptions);
  }, []);

  async function handleCreate() {
    setError(null);
    setIsSaving(true);
    try {
      const [fromCityId, toCityId] = await Promise.all([
        resolveCityId(fromCity),
        resolveCityId(toCity),
      ]);
      if (!fromCityId || !toCityId) {
        setError(dictionary.createListing.publishCityError);
        return;
      }
      const created = await createSubscription({ fromCityId, toCityId });
      setSubscriptions((prev) => [created, ...prev]);
      setFromCity("");
      setToCity("");
      setIsAdding(false);
    } catch {
      setError(dictionary.profile.tooManySubscriptions);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(subscription: RouteSubscription) {
    const updated = await setSubscriptionActive(subscription.id, !subscription.isActive);
    setSubscriptions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleDelete(id: string) {
    await deleteSubscription(id);
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="mt-6">
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        {dictionary.profile.subscriptionsTitle}
      </p>

      {subscriptions.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground">{dictionary.profile.subscriptionsEmpty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3.5 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-heading truncate text-sm font-bold text-card-foreground">
                  {subscription.fromCity} → {subscription.toCity}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {dictionary.profile.subscriptionMatches(subscription.matchCount)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggle(subscription)}
                  className="font-heading rounded-sm border border-border px-2.5 py-1.5 text-xs font-bold text-foreground"
                >
                  {subscription.isActive
                    ? dictionary.profile.disableSubscriptionCta
                    : dictionary.profile.enableSubscriptionCta}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(subscription.id)}
                  className="font-heading rounded-sm border border-border px-2.5 py-1.5 text-xs font-bold text-destructive"
                >
                  {dictionary.profile.deleteSubscriptionCta}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdding ? (
        <div className="mt-3 rounded-md border border-border bg-card p-3.5 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <CityPicker placeholder={dictionary.createListing.fromLabel} value={fromCity} onChange={setFromCity} />
            <CityPicker placeholder={dictionary.createListing.toLabel} value={toCity} onChange={setToCity} />
          </div>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="font-heading flex-1 rounded-sm border border-border py-2 text-xs font-bold text-foreground"
            >
              {dictionary.profile.cancelCta}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSaving || !fromCity || !toCity}
              className="font-heading flex-1 rounded-sm bg-action py-2 text-xs font-bold text-on-action disabled:opacity-50"
            >
              {dictionary.profile.subscribeCta}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="font-heading mt-3 w-full rounded-sm border border-border py-2.5 text-sm font-bold text-foreground"
        >
          {dictionary.profile.addSubscriptionCta}
        </button>
      )}
    </div>
  );
}
