"use client";

import { useState } from "react";
import { dictionary } from "@/lib/dictionary";
import { cities, type ListingType } from "@/lib/mock-data";

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
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function NewListingPage() {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ListingType>("trip");

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

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

      <div className="mt-6 rounded-lg border border-border bg-card p-4 shadow-sm">
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <Field label={dictionary.createListing.typeLabel}>
              <div className="inline-flex rounded-full border border-border p-1">
                <button
                  type="button"
                  onClick={() => setType("trip")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    type === "trip" ? "bg-primary text-on-primary" : "text-muted-foreground"
                  }`}
                >
                  {dictionary.createListing.typeTrip}
                </button>
                <button
                  type="button"
                  onClick={() => setType("request")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
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
              <Field label={dictionary.createListing.fromLabel}>
                <select className={inputClass} defaultValue={cities[0]}>
                  {cities.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
              </Field>
              <Field label={dictionary.createListing.toLabel}>
                <select className={inputClass} defaultValue={cities[5]}>
                  {cities.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={dictionary.createListing.dateLabel}>
              <input type="date" className={inputClass} />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-foreground">
              {dictionary.createListing.detailsStepTitle}
            </p>
            <Field label={dictionary.createListing.weightLabel}>
              <input type="number" min={0} placeholder="5" className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={dictionary.createListing.priceStepLabel}>
                <input type="number" min={0} placeholder="1200" className={inputClass} />
              </Field>
              <Field label={dictionary.createListing.minPriceStepLabel}>
                <input type="number" min={0} placeholder="3000" className={inputClass} />
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
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">{dictionary.createListing.aiHint}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={back}
            className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-foreground"
          >
            {dictionary.createListing.back}
          </button>
        ) : null}
        <button
          type="button"
          onClick={next}
          className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover"
        >
          {step === TOTAL_STEPS ? dictionary.createListing.publish : dictionary.createListing.next}
        </button>
      </div>
    </div>
  );
}
