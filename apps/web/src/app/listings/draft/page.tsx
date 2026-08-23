"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { type ListingType } from "@/lib/mock-data";
import { CityPicker } from "@/components/CityPicker";
import { WeightHint } from "@/components/WeightHint";
import { loadListingDraft, savePublishedListing } from "@/lib/listing-draft";

function fieldWrapperClass(isEmpty: boolean): string {
  return isEmpty
    ? "rounded-md border-2 border-destructive/60 bg-destructive/5 px-3.5 py-2.5"
    : "rounded-md border border-border bg-card px-3.5 py-2.5";
}

function inputInnerClass(): string {
  return "w-full bg-transparent text-sm text-foreground outline-none";
}

function DraftField({
  label,
  isEmpty,
  children,
}: {
  label: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-foreground">
        {label}
        {isEmpty ? (
          <span className="text-xs font-semibold text-destructive">
            {dictionary.createListing.draftFillManually}
          </span>
        ) : null}
      </span>
      <div className={fieldWrapperClass(isEmpty)}>{children}</div>
    </label>
  );
}

/**
 * Черновик объявления (визуальная демонстрация E13, сценарий 3): все поля
 * сразу на одной странице, вместо трёх шагов мастера — распознанные ИИ
 * значения предзаполнены и редактируемы, пустые подсвечены. Ничего не
 * сохраняется в базу — бэкенда объявлений (E07) ещё нет.
 */
export default function ListingDraftPage() {
  const router = useRouter();
  const [type, setType] = useState<ListingType>("trip");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [date, setDate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const draft = loadListingDraft();
    if (draft) {
      if (draft.type) setType(draft.type);
      if (draft.fromCity) setFromCity(draft.fromCity);
      if (draft.toCity) setToCity(draft.toCity);
      if (draft.date) setDate(draft.date);
      if (draft.weightKg != null) setWeightKg(String(draft.weightKg));
      if (draft.pricePerKg != null) setPricePerKg(String(draft.pricePerKg));
      if (draft.minPrice != null) setMinPrice(String(draft.minPrice));
    }
    setIsReady(true);
  }, []);

  const missingCount = [fromCity, toCity, date, weightKg, pricePerKg, minPrice].filter(
    (v) => v.trim().length === 0,
  ).length;

  if (!isReady) {
    return null;
  }

  return (
    <div className="py-6">
      <Link href="/listings/new" className="text-xs font-semibold text-muted-foreground">
        ← {dictionary.createListing.draftRestart}
      </Link>
      <h1 className="font-heading mt-2 text-2xl font-bold text-foreground">
        {dictionary.createListing.draftTitle}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {missingCount === 0
          ? dictionary.createListing.draftAllDetermined
          : dictionary.createListing.draftPartial(missingCount)}
      </p>

      <div className="mt-5 flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-sm">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {dictionary.createListing.typeLabel}
          </span>
          <div className="inline-flex rounded-sm border border-border p-1">
            <button
              type="button"
              onClick={() => setType("trip")}
              className={`font-heading rounded-sm px-4 py-1.5 text-sm font-bold transition-colors ${
                type === "trip" ? "bg-primary text-on-primary" : "text-muted-foreground"
              }`}
            >
              {dictionary.createListing.typeTrip}
            </button>
            <button
              type="button"
              onClick={() => setType("request")}
              className={`font-heading rounded-sm px-4 py-1.5 text-sm font-bold transition-colors ${
                type === "request" ? "bg-primary text-on-primary" : "text-muted-foreground"
              }`}
            >
              {dictionary.createListing.typeRequest}
            </button>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <DraftField label={dictionary.createListing.fromLabel} isEmpty={fromCity.trim().length === 0}>
            <CityPicker
              placeholder={dictionary.feed.anyCity}
              value={fromCity}
              onChange={setFromCity}
            />
          </DraftField>
          <DraftField label={dictionary.createListing.toLabel} isEmpty={toCity.trim().length === 0}>
            <CityPicker
              placeholder={dictionary.feed.anyCity}
              value={toCity}
              onChange={setToCity}
            />
          </DraftField>
        </div>

        <DraftField label={dictionary.createListing.dateLabel} isEmpty={date.trim().length === 0}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputInnerClass()}
          />
        </DraftField>

        <DraftField label={dictionary.createListing.weightLabel} isEmpty={weightKg.trim().length === 0}>
          <input
            type="number"
            min={0}
            placeholder="5"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className={inputInnerClass()}
          />
        </DraftField>
        <WeightHint />

        <div className="grid grid-cols-2 gap-3">
          <DraftField
            label={dictionary.createListing.priceStepLabel}
            isEmpty={pricePerKg.trim().length === 0}
          >
            <input
              type="number"
              min={0}
              placeholder="1200"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
              className={inputInnerClass()}
            />
          </DraftField>
          <DraftField label={dictionary.createListing.minPriceStepLabel} isEmpty={minPrice.trim().length === 0}>
            <input
              type="number"
              min={0}
              placeholder="3000"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className={inputInnerClass()}
            />
          </DraftField>
        </div>

        <DraftField label={dictionary.createListing.descriptionStepTitle} isEmpty={false}>
          <textarea
            rows={3}
            placeholder={dictionary.createListing.descriptionPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputInnerClass()}
          />
        </DraftField>

        <Link
          href="/stop-list"
          className="text-xs font-semibold text-primary underline decoration-dotted underline-offset-2"
        >
          {dictionary.createListing.stopListLink}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => {
          if (missingCount > 0) return;
          savePublishedListing({
            type,
            fromCity,
            toCity,
            date,
            weightKg,
            pricePerKg,
            minPrice,
            description,
          });
          router.push("/listings/published");
        }}
        disabled={missingCount > 0}
        className="font-heading mt-5 w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action transition-colors hover:bg-action-hover disabled:opacity-40"
      >
        {dictionary.createListing.publish}
      </button>
    </div>
  );
}
