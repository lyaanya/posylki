"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { type ListingType } from "@/lib/listings";
import { CityPicker } from "@/components/CityPicker";
import { WeightHint } from "@/components/WeightHint";
import { AiListingAssist } from "@/components/AiListingAssist";
import { saveListingDraft } from "@/lib/listing-draft";

const TOTAL_STEPS = 3;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ListingType>("trip");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [date, setDate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [description, setDescription] = useState("");

  const back = () => setStep((s) => Math.max(1, s - 1));

  function handlePrimaryAction() {
    if (step < TOTAL_STEPS) {
      setStep((s) => Math.min(TOTAL_STEPS, s + 1));
      return;
    }

    saveListingDraft({ type, fromCity, toCity, date, weightKg: Number(weightKg) || null, pricePerKg: Number(pricePerKg) || null, minPrice: Number(minPrice) || null, description });
    router.push("/listings/draft");
  }

  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        {dictionary.createListing.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {dictionary.createListing.step(step, TOTAL_STEPS)}
      </p>

      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <div className="mt-6 rounded-md border border-border bg-card p-4 shadow-sm">
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <AiListingAssist
              onParsed={(data) => {
                // Черновик собирается на отдельной странице со всеми полями
                // сразу — распознанные ИИ значения предзаполнены и доступны
                // для правки, пустые подсвечены (E13 п. 13.26: подтверждение
                // остаётся за человеком, ничего не публикуется само).
                saveListingDraft(data);
                router.push("/listings/draft");
              }}
            />

            <Field label={dictionary.createListing.typeLabel}>
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
            </Field>

            <p className="text-sm font-medium text-foreground">
              {dictionary.createListing.routeStepTitle}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className={inputClass}>
                <CityPicker
                  label={dictionary.createListing.fromLabel}
                  placeholder={dictionary.feed.anyCity}
                  value={fromCity}
                  onChange={setFromCity}
                />
              </div>
              <div className={inputClass}>
                <CityPicker
                  label={dictionary.createListing.toLabel}
                  placeholder={dictionary.feed.anyCity}
                  value={toCity}
                  onChange={setToCity}
                />
              </div>
            </div>
            <Field label={dictionary.createListing.dateLabel}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-foreground">
              {dictionary.createListing.detailsStepTitle}
            </p>
            <Field label={dictionary.createListing.weightLabel}>
              <input
                type="number"
                min={0}
                placeholder="5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className={inputClass}
              />
              <WeightHint />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={dictionary.createListing.priceStepLabel}>
                <input
                  type="number"
                  min={0}
                  placeholder="1200"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={dictionary.createListing.minPriceStepLabel}>
                <input
                  type="number"
                  min={0}
                  placeholder="3000"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">
              {dictionary.createListing.descriptionStepTitle}
            </p>
            <textarea
              rows={5}
              placeholder={dictionary.createListing.descriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
            <Link
              href="/stop-list"
              className="text-xs font-semibold text-primary underline decoration-dotted underline-offset-2"
            >
              {dictionary.createListing.stopListLink}
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={back}
            className="font-heading flex-1 rounded-sm border border-border py-3 text-sm font-bold text-foreground"
          >
            {dictionary.createListing.back}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handlePrimaryAction}
          className="font-heading flex-1 rounded-sm bg-action py-3 text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
        >
          {step === TOTAL_STEPS ? dictionary.createListing.reviewCta : dictionary.createListing.next}
        </button>
      </div>
    </div>
  );
}
