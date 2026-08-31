import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Формы совпадают с camelCase-ответом /complaints, /warnings (apps/api/src/moderation). */
export type ComplaintTargetType = "user" | "message" | "listing" | "review" | "deal";
export type ComplaintCategory =
  | "fraud"
  | "prohibited_item"
  | "rudeness"
  | "breach_of_agreement"
  | "fake_documents"
  | "spam"
  | "other";
export type ComplaintStatus = "pending" | "reviewing" | "resolved" | "rejected";

export interface Complaint {
  id: string;
  authorId: string;
  targetType: ComplaintTargetType;
  targetId: string;
  category: ComplaintCategory;
  comment: string | null;
  photoUrls: string[];
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserWarning {
  id: string;
  userId: string;
  reason: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export class ModerationApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
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

async function parseErrorOrThrow(response: Response): Promise<never> {
  // Формат ошибок API — { error: { code, message, details } } (all-exceptions.filter.ts).
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  throw new ModerationApiError(
    body?.error?.code ?? "UNKNOWN",
    body?.error?.message ?? `API ответил ${response.status}`,
  );
}

async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(await authHeader()), ...init?.headers },
  });
  if (!response.ok) await parseErrorOrThrow(response);
  return (await response.json()) as T;
}

export async function uploadComplaintPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/complaints/photos`, {
    method: "POST",
    headers: await authHeader(),
    body: formData,
  });
  if (!response.ok) await parseErrorOrThrow(response);
  const data = (await response.json()) as { path: string };
  return data.path;
}

export function createComplaint(input: {
  targetType: ComplaintTargetType;
  targetId: string;
  category: ComplaintCategory;
  comment?: string | undefined;
  photoPaths?: string[] | undefined;
}): Promise<Complaint> {
  return apiCall<Complaint>("/complaints", { method: "POST", body: JSON.stringify(input) });
}

export function fetchMyComplaints(): Promise<Complaint[]> {
  return apiCall<Complaint[]>("/complaints/mine");
}

/** ТЗ п.12.12 — самое старое непрочитанное предупреждение, или null, если таких нет. */
export function fetchPendingWarning(): Promise<UserWarning | null> {
  return apiCall<UserWarning | null>("/warnings/pending").catch(() => null);
}

export function acknowledgeWarning(id: string): Promise<UserWarning> {
  return apiCall<UserWarning>(`/warnings/${id}/acknowledge`, { method: "POST" });
}

export type AccountStatus = { blocked: false } | { blocked: true; reason: string };

/**
 * ТЗ п.12.15 — заблокированный пользователь получает от AuthGuard
 * ACCOUNT_BLOCKED/403 с причиной на любом защищённом эндпоинте; /profile/me
 * — самый лёгкий такой эндпоинт, поэтому используем его как индикатор.
 */
export async function checkAccountStatus(): Promise<AccountStatus> {
  const response = await fetch(`${API_URL}/profile/me`, { headers: await authHeader() });
  if (response.ok) return { blocked: false };
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; details?: { reason?: string } };
  } | null;
  if (body?.error?.code === "ACCOUNT_BLOCKED") {
    return { blocked: true, reason: body.error.details?.reason ?? "Аккаунт заблокирован" };
  }
  return { blocked: false };
}
