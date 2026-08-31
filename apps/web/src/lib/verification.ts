import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

export type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected";
export type VerificationRejectionReason =
  | "unreadable_photo"
  | "expired_document"
  | "data_mismatch"
  | "selfie_mismatch"
  | "review_timeout"
  | "other";

export interface OwnVerificationStatus {
  status: VerificationStatus;
  latestRequest: {
    status: "pending" | "approved" | "rejected";
    rejectionReasonCode: VerificationRejectionReason | null;
    rejectionComment: string | null;
    createdAt: string;
  } | null;
}

export interface DocumentType {
  id: string;
  name: string;
  countryCode: string;
}

export class VerificationApiError extends Error {
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
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  throw new VerificationApiError(
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

export function fetchDocumentTypes(country?: string): Promise<DocumentType[]> {
  const q = country ? `?country=${encodeURIComponent(country)}` : "";
  return fetch(`${API_URL}/directories/document-types${q}`).then((r) => r.json()) as Promise<DocumentType[]>;
}

export function fetchMyVerification(): Promise<OwnVerificationStatus> {
  return apiCall<OwnVerificationStatus>("/verification/mine");
}

/**
 * status.status (users.verification_status) переходит только в "approved"
 * или "rejected" — решением модератора; заявка на рассмотрении никогда не
 * меняет его на "pending". Живое состояние берём из latestRequest.
 */
export function effectiveVerificationStatus(
  s: OwnVerificationStatus,
): "not_submitted" | "pending" | "approved" | "rejected" {
  if (s.status === "approved") return "approved";
  if (s.latestRequest?.status === "pending") return "pending";
  if (s.latestRequest?.status === "rejected") return "rejected";
  return "not_submitted";
}

export async function uploadVerificationPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/verification/photos`, {
    method: "POST",
    headers: await authHeader(),
    body: formData,
  });
  if (!response.ok) await parseErrorOrThrow(response);
  const data = (await response.json()) as { path: string };
  return data.path;
}

export function submitVerification(input: {
  documentType: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  documentNumber: string;
  documentPhotoPath: string;
  selfiePhotoPath: string;
}): Promise<OwnVerificationStatus["latestRequest"]> {
  return apiCall("/verification", { method: "POST", body: JSON.stringify(input) });
}
