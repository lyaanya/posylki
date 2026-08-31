import { apiGet, apiPost } from "./api";

export interface AdminUserSearchResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  verificationStatus: string;
  isBlocked: boolean;
  createdAt: string;
}

export function searchUsers(q: string): Promise<AdminUserSearchResult[]> {
  return apiGet(`/admin/users/search?q=${encodeURIComponent(q)}`);
}

export interface AdminUserCard {
  profile: {
    id: string;
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    documentType: string | null;
    verificationStatus: string;
    verifiedAt: string | null;
    isBlocked: boolean;
    blockedReason: string | null;
    deletedAt: string | null;
    createdAt: string;
    referredById: string | null;
    referrerEmail: string | null;
  };
  listings: unknown[];
  deals: unknown[];
  reviewsReceived: unknown[];
  complaintsFiled: unknown[];
  complaintsReceived: unknown[];
  warnings: unknown[];
  bans: unknown[];
}

export function fetchUserCard(id: string): Promise<AdminUserCard> {
  return apiGet(`/admin/users/${id}`);
}

export type ModerateUserAction = "warn" | "ban_user" | "unban";

export function moderateUser(id: string, input: { action: ModerateUserAction; reason: string; banDurationDays?: number }): Promise<{ ok: true }> {
  return apiPost(`/admin/users/${id}/moderate`, input);
}
