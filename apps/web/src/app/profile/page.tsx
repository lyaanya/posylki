"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dictionary } from "@/lib/dictionary";
import { fetchMyListings, hideListing, unhideListing, type Listing } from "@/lib/listings";
import { fetchMyProfile, setReferral, updateMyProfile, uploadMyAvatar, type OwnProfile } from "@/lib/profile";
import { effectiveVerificationStatus, fetchMyVerification } from "@/lib/verification";
import { resolveCityId } from "@/lib/directories";
import { formatDate } from "@/lib/format-date";
import { signOut, useSession } from "@/lib/auth";
import { initials } from "@/lib/initials";
import { clearPendingReferrer, getPendingReferrerId } from "@/lib/referral";
import { ProfileSummary } from "@/components/ProfileSummary";
import { ReviewsSection } from "@/components/ReviewsSection";
import { CityPicker } from "@/components/CityPicker";
import { Avatar } from "@/components/Avatar";
import { InviteLinkCard } from "@/components/InviteLinkCard";
import { SubscriptionsSection } from "@/components/SubscriptionsSection";

/**
 * Свой профиль (E06 п. 6.8-6.11): фото, текст о себе, город и телефон
 * редактируются. Имя и фамилия по спецификации (4.20/6.9) должны приходить
 * только из одобренной верификации и не редактироваться пользователем
 * напрямую — это ещё не включено на уровне API (см. profile.controller.ts
 * на бэкенде), поэтому поле здесь пока остаётся редактируемым.
 */
export default function ProfilePage() {
  const router = useRouter();
  const session = useSession();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [verificationEffective, setVerificationEffective] = useState<
    "not_submitted" | "pending" | "approved" | "rejected" | null
  >(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [aboutInput, setAboutInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [togglingListingId, setTogglingListingId] = useState<string | null>(null);

  useEffect(() => {
    if (session.status !== "signedIn") return;
    let cancelled = false;

    fetchMyProfile().then(async (p) => {
      if (cancelled) return;
      // Одноразовый перенос имени из метаданных Google (см. lib/auth.ts) в
      // настоящий профиль — до этой правки имя жило только там.
      if (!p.displayName && session.displayName) {
        try {
          p = await updateMyProfile({ displayName: session.displayName });
        } catch {
          // Не критично — просто останется как есть, поле редактируемо руками.
        }
      }
      // ТЗ E08 п.8.17: если пришли по чужой ссылке-приглашению и ещё не
      // записаны ничьим приглашённым — фиксируем сейчас, раз уже есть сессия.
      const pendingReferrerId = getPendingReferrerId();
      if (!p.referredById && pendingReferrerId && pendingReferrerId !== p.id) {
        try {
          p = await setReferral(pendingReferrerId);
        } catch {
          // Не критично — ссылка могла оказаться на несуществующего пользователя.
        } finally {
          clearPendingReferrer();
        }
      } else if (pendingReferrerId) {
        clearPendingReferrer();
      }
      if (!cancelled) setProfile(p);
    }).catch(() => {
      // Ничего не делаем: например, ACCOUNT_BLOCKED — AccountStatusGate
      // уже покажет полноэкранный статус блокировки поверх этой страницы.
    });
    fetchMyListings().catch(() => []).then((listings) => {
      if (!cancelled) setMyListings(listings);
    });
    fetchMyVerification()
      .then((v) => {
        if (!cancelled) setVerificationEffective(effectiveVerificationStatus(v));
      })
      .catch(() => {
        if (!cancelled) setVerificationEffective("not_submitted");
      });

    return () => {
      cancelled = true;
    };
  }, [session.status]);

  if (session.status === "loading") {
    return null;
  }

  if (session.status === "signedOut") {
    return (
      <div className="py-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {dictionary.profile.title}
        </h1>
        <div className="mt-5 rounded-md border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{dictionary.profile.myListingsSignInHint}</p>
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

  if (!profile) {
    return null;
  }

  function startEditing() {
    if (!profile) return;
    setNameInput(profile.displayName ?? "");
    setAboutInput(profile.aboutText ?? "");
    setCityInput(profile.city ?? "");
    setPhoneInput(profile.phone ?? "");
    setIsEditing(true);
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // позволяет выбрать тот же файл ещё раз при ошибке
    if (!file) return;

    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const updated = await uploadMyAvatar(file);
      setProfile(updated);
    } catch {
      setAvatarError(dictionary.profile.avatarUploadError);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleToggleVisibility(listing: Listing) {
    setTogglingListingId(listing.id);
    try {
      const updated =
        listing.status === "published" ? await hideListing(listing.id) : await unhideListing(listing.id);
      setMyListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } finally {
      setTogglingListingId(null);
    }
  }

  async function saveProfile() {
    setIsSaving(true);
    try {
      let cityId: string | null | undefined = undefined;
      if (cityInput.trim() !== (profile?.city ?? "")) {
        cityId = cityInput.trim() ? await resolveCityId(cityInput.trim()) : null;
      }

      const updated = await updateMyProfile({
        displayName: nameInput.trim() || null,
        aboutText: aboutInput.trim() || null,
        phone: phoneInput.trim() || null,
        ...(cityId !== undefined ? { cityId } : {}),
      });
      setProfile(updated);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="py-6">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        {dictionary.profile.title}
      </h1>

      <div className="mt-5">
        {isEditing ? (
          <div className="rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <Avatar
                initials={initials(profile.displayName ?? "?")}
                imageUrl={profile.avatarUrl}
                size="lg"
              />
              <label className="font-heading cursor-pointer rounded-sm border border-border px-3.5 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted">
                {isUploadingAvatar ? dictionary.profile.avatarUploading : dictionary.profile.changePhotoCta}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploadingAvatar}
                  onChange={handleAvatarChange}
                />
              </label>
            </div>
            {avatarError ? <p className="mt-2 text-sm text-destructive">{avatarError}</p> : null}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                {dictionary.profile.namePlaceholder}
              </span>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={dictionary.profile.namePlaceholder}
                className="w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                {dictionary.profile.aboutTitle}
              </span>
              <textarea
                rows={3}
                value={aboutInput}
                onChange={(e) => setAboutInput(e.target.value)}
                placeholder={dictionary.profile.aboutPlaceholder}
                className="w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block rounded-md border border-border bg-background px-3.5 py-2.5">
                <span className="block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                  {dictionary.profile.cityLabel}
                </span>
                <CityPicker
                  placeholder={dictionary.profile.cityPlaceholder}
                  value={cityInput}
                  onChange={setCityInput}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  {dictionary.profile.phoneLabel}
                </span>
                <input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder={dictionary.profile.phonePlaceholder}
                  className="w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{dictionary.profile.phoneHint}</p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="font-heading flex-1 rounded-sm border border-border py-2.5 text-sm font-bold text-foreground"
              >
                {dictionary.profile.cancelCta}
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={isSaving}
                className="font-heading flex-1 rounded-sm bg-action py-2.5 text-sm font-bold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
              >
                {dictionary.profile.saveProfileCta}
              </button>
            </div>
          </div>
        ) : (
          <>
            <ProfileSummary profile={profile} />
            {verificationEffective && verificationEffective !== "approved" ? (
              <Link
                href="/verification"
                className="font-heading mt-4 block w-full rounded-sm bg-action py-3 text-center text-sm font-bold text-on-action"
              >
                {verificationEffective === "pending"
                  ? dictionary.profile.verificationPendingCta
                  : verificationEffective === "rejected"
                    ? dictionary.profile.verificationRejectedCta
                    : dictionary.profile.verifyCta}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={startEditing}
              className="font-heading mt-4 w-full rounded-sm border border-border py-3 text-sm font-bold text-foreground"
            >
              {dictionary.profile.editProfileCta}
            </button>
            <InviteLinkCard userId={profile.id} />
            <SubscriptionsSection />
            <ReviewsSection userId={profile.id} />
          </>
        )}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {dictionary.profile.myListingsTitle}
        </p>
        {myListings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dictionary.profile.myListingsEmpty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myListings.map((listing) => (
              <div
                key={listing.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3.5 shadow-sm"
              >
                <Link href={`/listings/${listing.id}`} className="min-w-0 flex-1">
                  <p className="font-heading truncate text-sm font-bold text-card-foreground">
                    {listing.fromCity} → {listing.toCity}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(listing.dateFrom)}
                    {listing.status === "hidden_by_author" ? ` · ${dictionary.listing.statusHidden}` : null}
                    {listing.status === "archived" ? ` · ${dictionary.listing.statusArchived}` : null}
                  </p>
                </Link>
                {listing.status === "published" || listing.status === "hidden_by_author" ? (
                  <button
                    type="button"
                    onClick={() => handleToggleVisibility(listing)}
                    disabled={togglingListingId === listing.id}
                    className="font-heading shrink-0 rounded-sm border border-border px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-50"
                  >
                    {togglingListingId === listing.id
                      ? dictionary.createListing.hiding
                      : listing.status === "published"
                        ? dictionary.createListing.hideCta
                        : dictionary.createListing.unhideCta}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/complaints"
        className="font-heading mt-6 block w-full rounded-sm border border-border py-3 text-center text-sm font-bold text-foreground"
      >
        {dictionary.moderation.myComplaintsLink}
      </Link>

      <Link
        href="/support"
        className="font-heading mt-2 block w-full rounded-sm border border-border py-3 text-center text-sm font-bold text-foreground"
      >
        {dictionary.support.cta}
      </Link>

      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.push("/");
        }}
        className="font-heading mt-2 w-full rounded-sm border border-border py-3 text-sm font-bold text-foreground"
      >
        {dictionary.profile.signOutCta}
      </button>
    </div>
  );
}
