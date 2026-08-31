"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { dictionary } from "@/lib/dictionary";
import { useSession } from "@/lib/auth";
import { fetchMyProfile } from "@/lib/profile";
import { formatDate } from "@/lib/format-date";
import {
  DealApiError,
  addDealItem,
  arriveDeal,
  cancelDeal,
  completeDeal,
  confirmDealTerms,
  confirmHandover,
  decideStorageExtension,
  deliverDeal,
  departDeal,
  fetchDeal,
  handoverDeal,
  recordDealConsent,
  requestStorageExtension,
  setDealContact,
  setDealTerms,
  uploadDealPhoto,
  type ConsentType,
  type ContactEvent,
  type ContactRole,
  type Deal,
  type DealCancelReason,
} from "@/lib/deals";
import { Avatar } from "@/components/Avatar";
import { DealReviewSection } from "@/components/DealReviewSection";
import { ComplaintButton } from "@/components/ComplaintButton";

const STEPS: { status: Deal["status"]; label: keyof typeof dictionary.deal }[] = [
  { status: "responded", label: "stepAgreement" },
  { status: "handed_over", label: "stepHandover" },
  { status: "in_transit", label: "stepTransit" },
  { status: "delivered", label: "stepDelivery" },
];

const STEP_ORDER: Deal["status"][] = [
  "responded",
  "agreed",
  "handed_over",
  "in_transit",
  "awaiting_pickup",
  "delivered",
  "completed",
];

function stepIndexOf(status: Deal["status"]): number {
  const idx = STEP_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function formatPrice(minor: number | null, decimals: number, symbol: string): string {
  if (minor === null) return "—";
  return `${(minor / 10 ** (decimals || 0)).toLocaleString("ru-RU")} ${symbol}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof DealApiError) {
    const map: Record<string, string> = {
      ONLY_RESPONDER_CAN_START_DEAL: dictionary.deal.onlyResponderError,
      COUNTERPART_NOT_VERIFIED: dictionary.deal.counterpartNotVerifiedError,
      VERIFICATION_REQUIRED: dictionary.deal.verificationRequiredError,
      ITEM_ON_STOP_LIST: dictionary.deal.itemStopListError,
      TERMS_REQUIRED: dictionary.deal.termsRequiredError,
      NOT_ENOUGH_WEIGHT: dictionary.deal.notEnoughWeightError,
      PHOTO_REQUIRED: dictionary.deal.photoRequiredError,
      COURIER_HAS_NOT_MARKED_HANDOVER: dictionary.deal.courierNotMarkedYet,
      CANCEL_NOT_ALLOWED: dictionary.deal.cancelNotAllowedError,
    };
    return map[err.code] ?? err.message ?? dictionary.deal.genericError;
  }
  return dictionary.deal.genericError;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-md border border-border bg-card p-4 shadow-sm">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm font-medium text-muted-foreground">{children}</p>;
}

export default function DealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = use(params);
  const session = useSession();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemWeight, setItemWeight] = useState("");

  const [declaredWeight, setDeclaredWeight] = useState("");
  const [price, setPrice] = useState("");

  const [actualWeight, setActualWeight] = useState("");
  const [pendingPhotoPaths, setPendingPhotoPaths] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [cancelReason, setCancelReason] = useState<DealCancelReason>("changed_mind");
  const [cancelComment, setCancelComment] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);

  const [extensionDate, setExtensionDate] = useState("");

  const [contactDrafts, setContactDrafts] = useState<Record<string, { name: string; phone: string }>>({});

  async function reload() {
    const fresh = await fetchDeal(dealId);
    setDeal(fresh);
    setDeclaredWeight(fresh.declaredWeightGrams !== null ? String(fresh.declaredWeightGrams / 1000) : "");
    setPrice(fresh.priceMinor !== null ? String(fresh.priceMinor / 10 ** 2) : "");
  }

  useEffect(() => {
    if (session.status !== "signedIn") return;
    let cancelled = false;
    Promise.all([fetchDeal(dealId), fetchMyProfile()]).then(([d, profile]) => {
      if (cancelled) return;
      setDeal(d);
      setMyId(profile.id);
      setDeclaredWeight(d.declaredWeightGrams !== null ? String(d.declaredWeightGrams / 1000) : "");
      setPrice(d.priceMinor !== null ? String(d.priceMinor / 100) : "");
    });
    return () => {
      cancelled = true;
    };
  }, [session.status, dealId]);

  async function runAction<T>(action: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    setBusy(true);
    try {
      return await action();
    } catch (err) {
      setError(errorMessage(err));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  if (session.status === "loading" || (session.status === "signedIn" && !deal)) {
    return null;
  }
  if (session.status === "signedOut") {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{dictionary.deal.signInHint}</p>
        <Link href="/login" className="mt-3 inline-block text-sm font-medium text-primary">
          {dictionary.auth.signInCta}
        </Link>
      </div>
    );
  }
  if (!deal || !myId) return null;

  const role: "customer" | "courier" = deal.customer.id === myId ? "customer" : "courier";
  const counterpart = role === "customer" ? deal.courier : deal.customer;
  const hasWarnings = deal.items.some((i) => i.warningText);
  const myStopListConsent = deal.consents.some((c) => c.userId === myId && c.consentType === "stop_list");
  const myWarningConsent = deal.consents.some((c) => c.userId === myId && c.consentType === "item_warning");
  const currentStepIndex = stepIndexOf(deal.status);
  const isTerminal = deal.status === "completed" || deal.status === "cancelled" || deal.status === "problem";

  function contactKey(event: ContactEvent, contactRole: ContactRole): string {
    return `${event}:${contactRole}`;
  }
  function contactValue(event: ContactEvent, contactRole: ContactRole): { name: string; phone: string } {
    const key = contactKey(event, contactRole);
    if (contactDrafts[key]) return contactDrafts[key]!;
    const existing = deal!.contacts.find((c) => c.event === event && c.role === contactRole);
    return { name: existing?.name ?? "", phone: existing?.phone ?? "" };
  }

  async function saveContact(event: ContactEvent, contactRole: ContactRole) {
    const value = contactValue(event, contactRole);
    if (!value.name.trim() || !value.phone.trim()) return;
    await runAction(() => setDealContact(dealId, { event, role: contactRole, name: value.name, phone: value.phone }));
    await reload();
  }

  async function handleAddItem() {
    if (!itemName.trim()) return;
    const result = await runAction(() =>
      addDealItem(dealId, {
        name: itemName.trim(),
        quantity: Number(itemQuantity) || 1,
        weightKg: itemWeight ? Number(itemWeight) : undefined,
      }),
    );
    if (result) {
      setItemName("");
      setItemQuantity("1");
      setItemWeight("");
      await reload();
    }
  }

  async function handleSaveTerms() {
    await runAction(() =>
      setDealTerms(dealId, {
        declaredWeightKg: declaredWeight ? Number(declaredWeight) : undefined,
        price: price ? Number(price) : undefined,
      }),
    );
    await reload();
  }

  async function handleConsent(type: ConsentType) {
    await runAction(() => recordDealConsent(dealId, type));
    await reload();
  }

  async function handleConfirmTerms() {
    await runAction(() => confirmDealTerms(dealId));
    await reload();
  }

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploadingPhoto(true);
    const result = await runAction(() => uploadDealPhoto(dealId, file));
    setIsUploadingPhoto(false);
    if (result) setPendingPhotoPaths((prev) => [...prev, result]);
  }

  async function handleHandover() {
    const result = await runAction(() =>
      handoverDeal(dealId, {
        actualWeightKg: actualWeight ? Number(actualWeight) : undefined,
        photoStoragePaths: pendingPhotoPaths,
      }),
    );
    if (result) {
      setPendingPhotoPaths([]);
      setActualWeight("");
      await reload();
    }
  }

  async function handleCancel() {
    await runAction(() => cancelDeal(dealId, { reason: cancelReason, comment: cancelComment || undefined }));
    setShowCancelForm(false);
    await reload();
  }

  async function handleExtensionRequest() {
    if (!extensionDate) return;
    await runAction(() => requestStorageExtension(dealId, extensionDate));
    setExtensionDate("");
    await reload();
  }

  return (
    <div className="py-6">
      <Link href="/deals" className="text-sm text-muted-foreground hover:text-foreground">
        ← {dictionary.deal.backCta}
      </Link>

      <div className="mt-3 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {deal.fromCity} → {deal.toCity}
        </h1>
        <ComplaintButton targetType="deal" targetId={deal.id} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <span className="text-sm font-medium text-foreground">{dictionary.deal.statusLabels[deal.status]}</span>
        </div>
        <Link
          href={`/support?dealId=${deal.id}`}
          className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {dictionary.support.cta}
        </Link>
      </div>

      {!isTerminal ? (
        <div className="mt-4 grid grid-cols-4 gap-1">
          {STEPS.map((step) => {
            const active = currentStepIndex >= stepIndexOf(step.status);
            return (
              <div key={step.status} className="flex flex-col items-center gap-1.5">
                <div className={`h-1.5 w-full rounded-full ${active ? "bg-primary" : "bg-border"}`} />
                <span
                  className={`text-center text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  {dictionary.deal[step.label] as string}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <Card>
        <SectionTitle>{role === "customer" ? dictionary.deal.courierLabel : dictionary.deal.customerLabel}</SectionTitle>
        <div className="flex items-center gap-3">
          <Avatar initials={counterpart.initials} imageUrl={counterpart.avatarUrl} />
          <p className="font-heading text-sm font-semibold text-card-foreground">{counterpart.name}</p>
        </div>
      </Card>

      <Card>
        <SectionTitle>{dictionary.deal.itemsTitle}</SectionTitle>
        {deal.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dictionary.deal.itemsEmpty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {deal.items.map((item) => (
              <div key={item.id} className="border-b border-border pb-2 last:border-none">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-card-foreground">
                    {item.name} × {item.quantity}
                  </span>
                  {item.weightGrams !== null ? (
                    <span className="text-muted-foreground">{item.weightGrams / 1000} кг</span>
                  ) : null}
                </div>
                {item.warningText ? (
                  <p className="mt-1 text-xs text-destructive">{item.warningText}</p>
                ) : null}
                {item.aiCheckFailed ? (
                  <p className="mt-1 text-xs text-muted-foreground">{dictionary.deal.itemAiFailedBadge}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {deal.status === "responded" ? (
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={dictionary.deal.itemNamePlaceholder}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                placeholder={dictionary.deal.itemQuantityLabel}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                type="number"
                min={0}
                step={0.1}
                value={itemWeight}
                onChange={(e) => setItemWeight(e.target.value)}
                placeholder={dictionary.deal.itemWeightLabel}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={busy || !itemName.trim()}
              className="font-heading rounded-sm border border-border py-2 text-sm font-bold text-foreground disabled:opacity-50"
            >
              {busy ? dictionary.deal.itemAdding : dictionary.deal.addItemCta}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{dictionary.deal.itemsLockedHint}</p>
        )}
      </Card>

      <Card>
        <SectionTitle>{dictionary.deal.termsTitle}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3 text-center">
            <p className="font-heading text-xl font-bold text-card-foreground">
              {deal.declaredWeightGrams !== null ? deal.declaredWeightGrams / 1000 : dictionary.deal.weightWaiting} кг
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{dictionary.deal.weightDeclaredLabel}</p>
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <p className="font-heading text-xl font-bold text-card-foreground">
              {deal.actualWeightGrams !== null ? deal.actualWeightGrams / 1000 : dictionary.deal.weightWaiting} кг
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{dictionary.deal.weightActualLabel}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-foreground">
          {dictionary.deal.priceLabel}: {formatPrice(deal.priceMinor, 2, deal.currencySymbol)}
        </p>

        {deal.status === "responded" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={declaredWeight}
              onChange={(e) => setDeclaredWeight(e.target.value)}
              placeholder={dictionary.deal.declaredWeightLabel}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={dictionary.deal.priceLabel}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSaveTerms}
              disabled={busy}
              className="font-heading col-span-2 rounded-sm border border-border py-2 text-sm font-bold text-foreground disabled:opacity-50"
            >
              {dictionary.deal.saveTermsCta}
            </button>
          </div>
        ) : null}
      </Card>

      {deal.status === "responded" ? (
        <Card>
          <SectionTitle>{dictionary.deal.consentsTitle}</SectionTitle>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">{dictionary.deal.stopListConsentLabel}</p>
            <button
              type="button"
              onClick={() => handleConsent("stop_list")}
              disabled={busy || myStopListConsent}
              className="font-heading shrink-0 rounded-sm border border-border px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-50"
            >
              {myStopListConsent ? dictionary.deal.stopListConsentDone : dictionary.deal.stopListConsentCta}
            </button>
          </div>
          {hasWarnings ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-sm text-foreground">{dictionary.deal.itemWarningTitle}</p>
              <button
                type="button"
                onClick={() => handleConsent("item_warning")}
                disabled={busy || myWarningConsent}
                className="font-heading shrink-0 rounded-sm border border-border px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-50"
              >
                {myWarningConsent ? dictionary.deal.itemWarningConsentDone : dictionary.deal.itemWarningConsentCta}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleConfirmTerms}
            disabled={busy}
            className="font-heading mt-4 w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
          >
            {dictionary.deal.confirmTermsCta}
          </button>
          {(role === "customer" && deal.customerAgreedAt) || (role === "courier" && deal.courierAgreedAt) ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">{dictionary.deal.waitingForOtherSide}</p>
          ) : null}
        </Card>
      ) : null}

      {deal.status === "agreed" && (!deal.courierAgreedAt || !deal.customerAgreedAt) ? (
        <Card>
          <p className="text-sm text-destructive">{dictionary.deal.needsReconfirmation}</p>
          <button
            type="button"
            onClick={handleConfirmTerms}
            disabled={busy}
            className="font-heading mt-3 w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action disabled:opacity-60"
          >
            {dictionary.deal.confirmTermsCta}
          </button>
        </Card>
      ) : null}

      {deal.status !== "responded" ? (
        <Card>
          <SectionTitle>{dictionary.deal.contactsTitle}</SectionTitle>
          {(
            [
              ["handover", "customer", dictionary.deal.contactHandoverCustomer],
              ["handover", "courier", dictionary.deal.contactHandoverCourier],
              ["pickup", "customer", dictionary.deal.contactPickupCustomer],
              ["pickup", "courier", dictionary.deal.contactPickupCourier],
            ] as [ContactEvent, ContactRole, string][]
          ).map(([event, contactRole, label]) => {
            const key = contactKey(event, contactRole);
            const value = contactValue(event, contactRole);
            return (
              <div key={key} className="mb-3 border-b border-border pb-3 last:mb-0 last:border-none">
                <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
                <div className="flex gap-2">
                  <input
                    value={value.name}
                    onChange={(e) =>
                      setContactDrafts((prev) => ({ ...prev, [key]: { ...value, name: e.target.value } }))
                    }
                    placeholder={dictionary.deal.contactNamePlaceholder}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <input
                    value={value.phone}
                    onChange={(e) =>
                      setContactDrafts((prev) => ({ ...prev, [key]: { ...value, phone: e.target.value } }))
                    }
                    placeholder={dictionary.deal.contactPhonePlaceholder}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => saveContact(event, contactRole)}
                    disabled={busy}
                    className="font-heading shrink-0 rounded-sm border border-border px-3 text-xs font-bold text-foreground disabled:opacity-50"
                  >
                    {dictionary.deal.saveContactCta}
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      ) : null}

      {deal.status === "agreed" ? (
        <Card>
          <SectionTitle>{dictionary.deal.photosTitle}</SectionTitle>
          {deal.photos.length > 0 ? (
            <div className="mb-3 flex gap-2 overflow-x-auto">
              {deal.photos.map((p) => (
                // Подписанные ссылки на Storage — как и в Avatar/чате, без next/image.
                <img key={p.id} src={p.url} alt="" className="size-16 shrink-0 rounded-sm object-cover" />
              ))}
              {pendingPhotoPaths.map((path) => (
                <div key={path} className="flex size-16 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-xs text-muted-foreground">
                  📷
                </div>
              ))}
            </div>
          ) : pendingPhotoPaths.length > 0 ? (
            <div className="mb-3 flex gap-2">
              {pendingPhotoPaths.map((path) => (
                <div key={path} className="flex size-16 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-xs text-muted-foreground">
                  📷
                </div>
              ))}
            </div>
          ) : null}
          <label className="font-heading inline-block cursor-pointer rounded-sm border border-border px-3.5 py-2 text-sm font-bold text-foreground">
            {isUploadingPhoto ? dictionary.deal.uploadingPhoto : dictionary.deal.addPhotoCta}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={isUploadingPhoto}
              onChange={handlePhotoSelect}
            />
          </label>
        </Card>
      ) : null}

      {/* Действия по статусу */}
      {deal.status === "agreed" && role === "courier" && deal.courierAgreedAt && deal.customerAgreedAt ? (
        <Card>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={actualWeight}
            onChange={(e) => setActualWeight(e.target.value)}
            placeholder={dictionary.deal.actualWeightLabel}
            className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={handleHandover}
            disabled={busy}
            className="font-heading w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action disabled:opacity-60"
          >
            {dictionary.deal.handoverCta}
          </button>
        </Card>
      ) : null}

      {deal.status === "agreed" && role === "customer" ? (
        <Card>
          {deal.courierHandedOverAt ? (
            <button
              type="button"
              onClick={() => runAction(confirmHandover.bind(null, dealId)).then(reload)}
              disabled={busy}
              className="font-heading w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action disabled:opacity-60"
            >
              {dictionary.deal.confirmHandoverCta}
            </button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{dictionary.deal.courierNotMarkedYet}</p>
          )}
        </Card>
      ) : null}

      {deal.status === "handed_over" && role === "courier" ? (
        <Card>
          <button
            type="button"
            onClick={() => runAction(departDeal.bind(null, dealId)).then(reload)}
            disabled={busy}
            className="font-heading w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action disabled:opacity-60"
          >
            {dictionary.deal.departCta}
          </button>
        </Card>
      ) : null}

      {deal.status === "in_transit" && role === "courier" ? (
        <Card>
          <button
            type="button"
            onClick={() => runAction(arriveDeal.bind(null, dealId)).then(reload)}
            disabled={busy}
            className="font-heading w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action disabled:opacity-60"
          >
            {dictionary.deal.arriveCta}
          </button>
        </Card>
      ) : null}

      {deal.status === "awaiting_pickup" ? (
        <Card>
          <SectionTitle>{dictionary.deal.storageTitle}</SectionTitle>
          <p className="text-sm text-foreground">
            {dictionary.deal.storageUntilLabel}: {deal.storageUntilDate ? formatDate(deal.storageUntilDate) : "—"}
          </p>

          {deal.storageExtensionRequests.map((req) => (
            <div key={req.id} className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatDate(req.requestedUntilDate)} —{" "}
                {req.status === "pending"
                  ? dictionary.deal.extensionPending
                  : req.status === "approved"
                    ? dictionary.deal.extensionApproved
                    : dictionary.deal.extensionRejected}
              </span>
              {req.status === "pending" && role === "courier" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => runAction(() => decideStorageExtension(dealId, req.id, "approve")).then(reload)}
                    className="font-heading rounded-sm border border-border px-2.5 py-1 text-xs font-bold text-foreground"
                  >
                    {dictionary.deal.approveCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(() => decideStorageExtension(dealId, req.id, "reject")).then(reload)}
                    className="font-heading rounded-sm border border-border px-2.5 py-1 text-xs font-bold text-destructive"
                  >
                    {dictionary.deal.rejectCta}
                  </button>
                </div>
              ) : null}
            </div>
          ))}

          {role === "customer" ? (
            <div className="mt-3 flex gap-2">
              <input
                type="date"
                value={extensionDate}
                onChange={(e) => setExtensionDate(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleExtensionRequest}
                disabled={busy || !extensionDate}
                className="font-heading shrink-0 rounded-sm border border-border px-3 text-xs font-bold text-foreground disabled:opacity-50"
              >
                {dictionary.deal.extensionRequestCta}
              </button>
            </div>
          ) : null}

          {role === "courier" ? (
            <button
              type="button"
              onClick={() => runAction(deliverDeal.bind(null, dealId)).then(reload)}
              disabled={busy}
              className="font-heading mt-4 w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action disabled:opacity-60"
            >
              {dictionary.deal.deliverCta}
            </button>
          ) : null}
        </Card>
      ) : null}

      {deal.status === "delivered" && role === "customer" ? (
        <Card>
          <button
            type="button"
            onClick={() => runAction(completeDeal.bind(null, dealId)).then(reload)}
            disabled={busy}
            className="font-heading w-full rounded-sm bg-action py-3 text-sm font-bold text-on-action disabled:opacity-60"
          >
            {dictionary.deal.completeCta}
          </button>
        </Card>
      ) : null}

      {deal.status === "completed" ? <DealReviewSection dealId={deal.id} /> : null}

      {deal.status === "cancelled" ? (
        <Card>
          <p className="text-sm text-foreground">
            {dictionary.deal.cancelReasonLabel}: {dictionary.deal.cancelReasons[deal.cancelReason ?? "other"]}
          </p>
          {deal.cancelComment ? <p className="mt-1 text-sm text-muted-foreground">{deal.cancelComment}</p> : null}
        </Card>
      ) : null}

      {deal.status === "problem" ? (
        <Card>
          <p className="text-sm text-destructive">{dictionary.deal.statusLabels.problem}</p>
        </Card>
      ) : null}

      {(deal.status === "responded" || deal.status === "agreed") && !showCancelForm ? (
        <button
          type="button"
          onClick={() => setShowCancelForm(true)}
          className="font-heading mt-4 w-full rounded-sm border border-border py-3 text-sm font-bold text-destructive"
        >
          {dictionary.deal.cancelCta}
        </button>
      ) : null}

      {showCancelForm ? (
        <Card>
          <SectionTitle>{dictionary.deal.cancelTitle}</SectionTitle>
          <select
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value as DealCancelReason)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {Object.entries(dictionary.deal.cancelReasons).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            rows={2}
            value={cancelComment}
            onChange={(e) => setCancelComment(e.target.value)}
            placeholder={dictionary.deal.cancelCommentLabel}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setShowCancelForm(false)}
              className="font-heading flex-1 rounded-sm border border-border py-2 text-sm font-bold text-foreground"
            >
              {dictionary.profile.cancelCta}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="font-heading flex-1 rounded-sm bg-destructive py-2 text-sm font-bold text-on-destructive disabled:opacity-60"
            >
              {dictionary.deal.cancelConfirmCta}
            </button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
