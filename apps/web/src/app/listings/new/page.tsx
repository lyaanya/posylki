"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { type ListingType } from "@/lib/listings";
import { fetchCurrencies, type Currency } from "@/lib/directories";
import { CityPicker } from "@/components/CityPicker";
import { WeightHint } from "@/components/WeightHint";
import { AiListingAssist } from "@/components/AiListingAssist";
import { saveListingDraft, draftFromParsedText } from "@/lib/listing-draft";
import { useSession } from "@/lib/auth";

const TOTAL_STEPS = 3;
const DEFAULT_CURRENCY_CODE = "RUB";

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
  const session = useSession();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ListingType>("trip");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_CURRENCY_CODE);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [pricePerKg, setPricePerKg] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [priceTotal, setPriceTotal] = useState("");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [dropoffInstructions, setDropoffInstructions] = useState("");
  const [storageUntilDate, setStorageUntilDate] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [arrivalAirport, setArrivalAirport] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (session.status === "signedOut") {
      router.replace("/login");
    }
  }, [session.status, router]);

  useEffect(() => {
    fetchCurrencies()
      .then(setCurrencies)
      .catch(() => setCurrencies([]));
  }, []);

  function saveAndGoToDraft() {
    saveListingDraft({
      type,
      fromCity,
      toCity,
      dateFrom,
      dateTo,
      weightKg: Number(weightKg) || null,
      currencyCode,
      pricePerKg: pricePerKg ? Number(pricePerKg) : null,
      minPrice: minPrice ? Number(minPrice) : null,
      priceTotal: priceTotal ? Number(priceTotal) : null,
      pickupInstructions: pickupInstructions || null,
      dropoffInstructions: dropoffInstructions || null,
      storageUntilDate: storageUntilDate || null,
      departureAirport: departureAirport || null,
      arrivalAirport: arrivalAirport || null,
      flightNumber: flightNumber || null,
      itemDescription: itemDescription || null,
      comment: comment || null,
    });
    router.push("/listings/draft");
  }

  const back = () => setStep((s) => Math.max(1, s - 1));

  if (session.status !== "signedIn") {
    return null;
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
                saveListingDraft(draftFromParsedText(data));
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
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={
                  type === "trip"
                    ? dictionary.createListing.dateFromLabelTrip
                    : dictionary.createListing.dateFromLabelRequest
                }
              >
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field
                label={
                  type === "trip"
                    ? dictionary.createListing.dateToLabelTrip
                    : dictionary.createListing.dateToLabelRequest
                }
              >
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-foreground">
              {type === "trip"
                ? dictionary.createListing.detailsStepTitle
                : dictionary.createListing.detailsStepTitleRequest}
            </p>
            <Field
              label={
                type === "trip" ? dictionary.createListing.weightLabel : dictionary.createListing.weightLabelRequest
              }
            >
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className={inputClass}
              />
              <WeightHint />
            </Field>

            <Field label={dictionary.createListing.currencyLabel}>
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className={inputClass}
              >
                {currencies.length === 0 ? (
                  <option value={DEFAULT_CURRENCY_CODE}>{DEFAULT_CURRENCY_CODE}</option>
                ) : (
                  currencies.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name} ({c.symbol})
                    </option>
                  ))
                )}
              </select>
            </Field>

            {type === "trip" ? (
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
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={dictionary.createListing.priceStepLabel}>
                    <input
                      type="number"
                      min={0}
                      placeholder="1200"
                      value={pricePerKg}
                      onChange={(e) => setPricePerKg(e.target.value)}
                      disabled={priceTotal.length > 0}
                      className={`${inputClass} disabled:opacity-50`}
                    />
                  </Field>
                  <Field label={dictionary.createListing.priceTotalStepLabel}>
                    <input
                      type="number"
                      min={0}
                      placeholder="3000"
                      value={priceTotal}
                      onChange={(e) => setPriceTotal(e.target.value)}
                      disabled={pricePerKg.length > 0}
                      className={`${inputClass} disabled:opacity-50`}
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">{dictionary.createListing.priceHint}</p>
              </>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            {type === "trip" ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  {dictionary.createListing.logisticsStepTitle}
                </p>
                <Field label={dictionary.createListing.pickupInstructionsLabel}>
                  <textarea
                    rows={2}
                    placeholder={dictionary.createListing.pickupInstructionsPlaceholder}
                    value={pickupInstructions}
                    onChange={(e) => setPickupInstructions(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={dictionary.createListing.dropoffInstructionsLabel}>
                  <textarea
                    rows={2}
                    placeholder={dictionary.createListing.dropoffInstructionsPlaceholder}
                    value={dropoffInstructions}
                    onChange={(e) => setDropoffInstructions(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={dictionary.createListing.storageUntilLabel}>
                  <input
                    type="date"
                    value={storageUntilDate}
                    onChange={(e) => setStorageUntilDate(e.target.value)}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dictionary.createListing.storageUntilHint}
                  </p>
                </Field>

                <p className="mt-2 text-sm font-medium text-foreground">
                  {dictionary.createListing.flightDetailsLabel}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={dictionary.createListing.departureAirportLabel}>
                    <input
                      value={departureAirport}
                      onChange={(e) => setDepartureAirport(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label={dictionary.createListing.arrivalAirportLabel}>
                    <input
                      value={arrivalAirport}
                      onChange={(e) => setArrivalAirport(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label={dictionary.createListing.flightNumberLabel}>
                  <input
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </>
            ) : (
              <Field label={dictionary.createListing.itemDescriptionLabel}>
                <textarea
                  rows={2}
                  placeholder={dictionary.createListing.itemDescriptionPlaceholder}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}

            <Field label={dictionary.createListing.commentLabel}>
              <textarea
                rows={3}
                placeholder={dictionary.createListing.descriptionPlaceholder}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className={inputClass}
              />
            </Field>
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
          onClick={() => {
            if (step < TOTAL_STEPS) {
              setStep((s) => Math.min(TOTAL_STEPS, s + 1));
              return;
            }
            saveAndGoToDraft();
          }}
          className="font-heading flex-1 rounded-sm bg-action py-3 text-sm font-bold text-on-action transition-colors hover:bg-action-hover"
        >
          {step === TOTAL_STEPS ? dictionary.createListing.reviewCta : dictionary.createListing.next}
        </button>
      </div>
    </div>
  );
}
