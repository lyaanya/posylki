import { apiGet, apiPost } from "./api";

export type VerificationRejectionReason = "unreadable_photo" | "expired_document" | "data_mismatch" | "selfie_mismatch" | "other";

export interface VerificationRequest {
  id: string;
  userId: string;
  documentType: string;
  submittedFirstName: string;
  submittedLastName: string;
  submittedDateOfBirth: string;
  documentPhotoPath: string | null;
  selfiePhotoPath: string | null;
  status: "pending" | "approved" | "rejected";
  rejectionReasonCode: VerificationRejectionReason | null;
  rejectionComment: string | null;
  createdAt: string;
}

export interface VerificationQueueItem extends VerificationRequest {
  waitingMinutes: number;
}

export interface VerificationDetail {
  request: VerificationRequest;
  documentPhotoUrl: string | null;
  selfiePhotoUrl: string | null;
  pastRequests: VerificationRequest[];
}

export function fetchVerificationQueue(): Promise<{ items: VerificationQueueItem[]; averageWaitingMinutes: number }> {
  return apiGet("/admin/verification/queue");
}

export function fetchVerificationDetail(id: string): Promise<VerificationDetail> {
  return apiGet(`/admin/verification/${id}`);
}

export function decideVerification(
  id: string,
  input: { approved: boolean; rejectionReasonCode?: VerificationRejectionReason; rejectionComment?: string },
): Promise<VerificationRequest> {
  return apiPost(`/admin/verification/${id}/decide`, input);
}
