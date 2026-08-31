"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { createListing, ListingApiError, type ListingType } from "@/lib/listings";
import { resolveCityId, resolveCurrencyId } from "@/lib/directories";
import { CityPicker } from "@/components/CityPicker";
import { WeightHint } from "@/components/WeightHint";
import { loadListingDraft, savePublishedListingId } from "@/lib/listing-draft";
import { useSession } from "@/lib/auth";

const DEFAULT_CURRENCY_CODE = "RUB";

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

function PlainField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <div className="rounded-md border border-border bg-card px-3.5 py-2.5">{children}</div>
    </label>
  );
}

/**
 * Черновик объявления: все поля сразу на одной странице — общий финальный
 * шаг и для ИИ-разбора (E13, сценарий 3, п. 13.26: результат всегда
 * подтверждает человек), и для ручного мастера. Публикация реально
 * сохраняет объявление через apps/api (E07 — полная модель, не демо-срез).
 */
export default function ListingDraftPage() {
  const router = useRouter();
  const session = useSession();
  const [type, setType] = useState<ListingType>("trip");
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_CURRENCY_CODE);
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
  const [isReady, setIsReady] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [wasRejectedByModeration, setWasRejectedByModeration] = useState(false);

  useEffect(() => {
    const draft = loadListingDraft();
    if (draft) {
      if (draft.type) setType(draft.type);
      if (draft.fromCity) setFromCity(draft.fromCity);
      if (draft.toCity) setToCity(draft.toCity);
      if (draft.dateFrom) setDateFrom(draft.dateFrom);
      if (draft.dateTo) setDateTo(draft.dateTo);
      if (draft.weightKg != null) setWeightKg(String(draft.weightKg));
      if (draft.currencyCode) setCurrencyCode(draft.currencyCode);
      if (draft.pricePerKg != null) setPricePerKg(String(draft.pricePerKg));
      if (draft.minPrice != null) setMinPrice(String(draft.minPrice));
      if (draft.priceTotal != null) setPriceTotal(String(draft.priceTotal));
      if (draft.pickupInstructions) setPickupInstructions(draft.pickupInstructions);
      if (draft.dropoffInstructions) setDropoffInstructions(draft.dropoffInstructions);
      if (draft.storageUntilDate) setStorageUntilDate(draft.storageUntilDate);
      if (draft.departureAirport) setDepartureAirport(draft.departureAirport);
      if (draft.arrivalAirport) setArrivalAirport(draft.arrivalAirport);
      if (draft.flightNumber) setFlightNumber(draft.flightNumber);
      if (draft.itemDescription) setItemDescription(draft.itemDescription);
      if (draft.comment) setComment(draft.comment);
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (session.status === "signedOut") {
      router.replace("/login");
    }
  }, [session.status, router]);

  const isTrip = type === "trip";
  const requiredFields = [
    fromCity,
    toCity,
    dateFrom,
    dateTo,
    weightKg,
    ...(isTrip ? [pricePerKg, minPrice, pickupInstructions, dropoffInstructions] : [itemDescription]),
  ];
  const missingCount = requiredFields.filter((v) => v.trim().length === 0).length;

  if (!isReady || session.status !== "signedIn") {
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
            <CityPicker placeholder={dictionary.feed.anyCity} value={fromCity} onChange={setFromCity} />
          </DraftField>
          <DraftField label={dictionary.createListing.toLabel} isEmpty={toCity.trim().length === 0}>
            <CityPicker placeholder={dictionary.feed.anyCity} value={toCity} onChange={setToCity} />
          </DraftField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DraftField
            label={isTrip ? dictionary.createListing.dateFromLabelTrip : dictionary.createListing.dateFromLabelRequest}
            isEmpty={dateFrom.trim().length === 0}
          >
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputInnerClass()}
            />
          </DraftField>
          <DraftField
            label={isTrip ? dictionary.createListing.dateToLabelTrip : dictionary.createListing.dateToLabelRequest}
            isEmpty={dateTo.trim().length === 0}
          >
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputInnerClass()}
            />
          </DraftField>
        </div>

        <DraftField
          label={isTrip ? dictionary.createListing.weightLabel : dictionary.createListing.weightLabelRequest}
          isEmpty={weightKg.trim().length === 0}
        >
          <input
            type="number"
            min={0}
            step={0.5}
            placeholder="5"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className={inputInnerClass()}
          />
        </DraftField>
        <WeightHint />

        <PlainField label={dictionary.createListing.currencyLabel}>
          <input
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
            className={inputInnerClass()}
          />
        </PlainField>

        {isTrip ? (
          <div className="grid grid-cols-2 gap-3">
            <DraftField label={dictionary.createListing.priceStepLabel} isEmpty={pricePerKg.trim().length === 0}>
              <input
                type="number"
                min={0}
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className={inputInnerClass()}
              />
            </DraftField>
            <DraftField label={dictionary.createListing.minPriceStepLabel} isEmpty={minPrice.trim().length === 0}>
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className={inputInnerClass()}
              />
            </DraftField>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <PlainField label={dictionary.createListing.priceStepLabel}>
              <input
                type="number"
                min={0}
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                disabled={priceTotal.length > 0}
                className={`${inputInnerClass()} disabled:opacity-50`}
              />
            </PlainField>
            <PlainField label={dictionary.createListing.priceTotalStepLabel}>
              <input
                type="number"
                min={0}
                value={priceTotal}
                onChange={(e) => setPriceTotal(e.target.value)}
                disabled={pricePerKg.length > 0}
                className={`${inputInnerClass()} disabled:opacity-50`}
              />
            </PlainField>
          </div>
        )}

        {isTrip ? (
          <>
            <DraftField
              label={dictionary.createListing.pickupInstructionsLabel}
              isEmpty={pickupInstructions.trim().length === 0}
            >
              <textarea
                rows={2}
                value={pickupInstructions}
                onChange={(e) => setPickupInstructions(e.target.value)}
                className={inputInnerClass()}
              />
            </DraftField>
            <DraftField
              label={dictionary.createListing.dropoffInstructionsLabel}
              isEmpty={dropoffInstructions.trim().length === 0}
            >
              <textarea
                rows={2}
                value={dropoffInstructions}
                onChange={(e) => setDropoffInstructions(e.target.value)}
                className={inputInnerClass()}
              />
            </DraftField>
            <PlainField label={dictionary.createListing.storageUntilLabel}>
              <input
                type="date"
                value={storageUntilDate}
                onChange={(e) => setStorageUntilDate(e.target.value)}
                className={inputInnerClass()}
              />
            </PlainField>
            <div className="grid grid-cols-2 gap-3">
              <PlainField label={dictionary.createListing.departureAirportLabel}>
                <input
                  value={departureAirport}
                  onChange={(e) => setDepartureAirport(e.target.value)}
                  className={inputInnerClass()}
                />
              </PlainField>
              <PlainField label={dictionary.createListing.arrivalAirportLabel}>
                <input
                  value={arrivalAirport}
                  onChange={(e) => setArrivalAirport(e.target.value)}
                  className={inputInnerClass()}
                />
              </PlainField>
            </div>
            <PlainField label={dictionary.createListing.flightNumberLabel}>
              <input
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                className={inputInnerClass()}
              />
            </PlainField>
          </>
        ) : (
          <DraftField
            label={dictionary.createListing.itemDescriptionLabel}
            isEmpty={itemDescription.trim().length === 0}
          >
            <textarea
              rows={2}
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              className={inputInnerClass()}
            />
          </DraftField>
        )}

        <PlainField label={dictionary.createListing.commentLabel}>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={inputInnerClass()}
          />
        </PlainField>

        <Link
          href="/stop-list"
          className="text-xs font-semibold text-primary underline decoration-dotted underline-offset-2"
        >
          {dictionary.createListing.stopListLink}
        </Link>
      </div>

      {publishError ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-destructive">{publishError}</p>
          {wasRejectedByModeration ? (
            <Link
              href="/support"
              className="mt-1.5 inline-block text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              {dictionary.support.cta}
            </Link>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={async () => {
          if (missingCount > 0 || isPublishing) return;
          setPublishError(null);
          setIsPublishing(true);

          try {
            const [fromCityId, toCityId, currencyId] = await Promise.all([
              resolveCityId(fromCity),
              resolveCityId(toCity),
              resolveCurrencyId(currencyCode),
            ]);
            if (!fromCityId || !toCityId) {
              setPublishError(dictionary.createListing.publishCityError);
              return;
            }
            if (!currencyId) {
              setPublishError(dictionary.createListing.publishCityError);
              return;
            }

            const created = await createListing({
              type,
              fromCityId,
              toCityId,
              currencyId,
              dateFrom,
              dateTo,
              weightKg: Number(weightKg),
              ...(isTrip
                ? { pricePerKg: Number(pricePerKg), minPrice: Number(minPrice) }
                : {
                    ...(pricePerKg ? { pricePerKg: Number(pricePerKg) } : {}),
                    ...(priceTotal ? { priceTotal: Number(priceTotal) } : {}),
                  }),
              ...(isTrip
                ? {
                    pickupInstructions,
                    dropoffInstructions,
                    ...(storageUntilDate ? { storageUntilDate } : {}),
                    ...(departureAirport ? { departureAirport } : {}),
                    ...(arrivalAirport ? { arrivalAirport } : {}),
                    ...(flightNumber ? { flightNumber } : {}),
                  }
                : { itemDescription }),
              ...(comment ? { comment } : {}),
            });

            savePublishedListingId(created.id);
            router.push("/listings/published");
          } catch (err) {
            // ТЗ E13 п.13.12 — при отклонении модерацией сервер уже
            // прислал готовый шаблонный текст, показываем его как есть.
            const rejectedByModeration =
              err instanceof ListingApiError && err.code === "LISTING_REJECTED_BY_MODERATION";
            setWasRejectedByModeration(rejectedByModeration);
            setPublishError(rejectedByModeration ? err.message : dictionary.createListing.publishError);
          } finally {
            setIsPublishing(false);
          }
        }}
        disabled={missingCount > 0 || isPublishing}
        className="font-heading mt-5 w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action transition-colors hover:bg-action-hover disabled:opacity-40"
      >
        {isPublishing ? dictionary.createListing.publishing : dictionary.createListing.publish}
      </button>
    </div>
  );
}
