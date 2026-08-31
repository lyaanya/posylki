import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { VerificationRejectionReason } from "../verification.types.js";

const REJECTION_REASONS: VerificationRejectionReason[] = [
  "unreadable_photo",
  "expired_document",
  "data_mismatch",
  "selfie_mismatch",
  "other",
];

/** ТЗ п.16.9 — одобрить, либо отклонить с причиной из перечня плюс комментарий. */
export class DecideVerificationDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsIn(REJECTION_REASONS)
  rejectionReasonCode?: VerificationRejectionReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionComment?: string;
}
