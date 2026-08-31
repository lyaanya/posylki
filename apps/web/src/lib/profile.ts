import { apiGet } from "./api";
import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Формы совпадают с camelCase-ответом /profile (apps/api/src/profile). */
export interface PublicProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  aboutText: string | null;
  city: string | null;
  verificationStatus: "not_submitted" | "pending" | "approved" | "rejected";
  courierRating: number | null;
  courierDealsCount: number;
  courierRatingCount: number;
  customerRating: number | null;
  customerDealsCount: number;
  customerRatingCount: number;
  frequentRoutes: string[];
  createdAt: string;
  /** ТЗ E08 п.8.20 — сколько людей зарегистрировалось по ссылке этого пользователя. */
  referredCount: number;
}

export type PublicProfileView =
  | ({ status: "active" } & PublicProfile)
  | { status: "blocked"; id: string }
  | { status: "deleted"; id: string };

export interface OwnProfile extends PublicProfile {
  email: string;
  phone: string | null;
  cityId: string | null;
  referredById: string | null;
}

export interface UpdateOwnProfileInput {
  displayName?: string | null;
  aboutText?: string | null;
  cityId?: string | null;
  phone?: string | null;
}

export function fetchPublicProfile(id: string): Promise<PublicProfileView | null> {
  return apiGet<PublicProfileView>(`/profile/${id}`).catch(() => null);
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Нужно войти в аккаунт");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function fetchMyProfile(): Promise<OwnProfile> {
  const response = await fetch(`${API_URL}/profile/me`, { headers: await authHeader() });
  if (!response.ok) {
    throw new Error(`API /profile/me ответил ${response.status}`);
  }
  return (await response.json()) as OwnProfile;
}

export async function uploadMyAvatar(file: File): Promise<OwnProfile> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/profile/me/avatar`, {
    method: "POST",
    headers: await authHeader(),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`API /profile/me/avatar ответил ${response.status}`);
  }
  return (await response.json()) as OwnProfile;
}

export async function updateMyProfile(input: UpdateOwnProfileInput): Promise<OwnProfile> {
  const response = await fetch(`${API_URL}/profile/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`API /profile/me ответил ${response.status}`);
  }
  return (await response.json()) as OwnProfile;
}

/** ТЗ E08 п.8.17 — фиксирует, кто кого привёл. Идемпотентно на бэкенде. */
export async function setReferral(referrerId: string): Promise<OwnProfile> {
  const response = await fetch(`${API_URL}/profile/me/referral`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ referrerId }),
  });
  if (!response.ok) {
    throw new Error(`API /profile/me/referral ответил ${response.status}`);
  }
  return (await response.json()) as OwnProfile;
}
