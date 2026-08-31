import type { ColumnType, Generated } from "kysely";
import type { VerificationStatus } from "../auth/auth.types.js";

export type VerificationRejectionReason =
  | "unreadable_photo"
  | "expired_document"
  | "data_mismatch"
  | "selfie_mismatch"
  | "other";

export interface VerificationRequestsTable {
  id: Generated<string>;
  user_id: string;
  document_type: string;
  submitted_first_name: string;
  submitted_last_name: string;
  submitted_date_of_birth: ColumnType<Date, string, string>;
  document_number_hash: string;
  document_photo_path: string | null;
  selfie_photo_path: string | null;
  status: Generated<"pending" | "approved" | "rejected">;
  rejection_reason_code: VerificationRejectionReason | null;
  rejection_comment: string | null;
  reviewed_by_admin_id: string | null;
  reviewed_at: ColumnType<Date | null, string | null, string | null>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

// === Доменные типы ===========================================================

export interface VerificationRequest {
  id: string;
  userId: string;
  documentType: string;
  submittedFirstName: string;
  submittedLastName: string;
  submittedDateOfBirth: string;
  documentNumberHash: string;
  documentPhotoPath: string | null;
  selfiePhotoPath: string | null;
  status: "pending" | "approved" | "rejected";
  rejectionReasonCode: VerificationRejectionReason | null;
  rejectionComment: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewVerificationRequest {
  userId: string;
  documentType: string;
  submittedFirstName: string;
  submittedLastName: string;
  submittedDateOfBirth: string;
  documentNumberHash: string;
  documentPhotoPath: string;
  selfiePhotoPath: string;
}

export interface DecideVerificationInput {
  approved: boolean;
  rejectionReasonCode?: VerificationRejectionReason | null;
  rejectionComment?: string | null;
  adminId: string;
}

/** Публичный статус для пользователя — без фото/хэша, только то, что нужно показать (E04). */
export interface OwnVerificationStatus {
  status: VerificationStatus;
  latestRequest: {
    status: "pending" | "approved" | "rejected";
    rejectionReasonCode: VerificationRejectionReason | null;
    rejectionComment: string | null;
    createdAt: Date;
  } | null;
}
