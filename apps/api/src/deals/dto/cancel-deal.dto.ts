import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { DealCancelReason } from "../deals.types.js";

const CANCEL_REASONS: DealCancelReason[] = [
  "changed_mind",
  "terms_not_agreed",
  "schedule_changed",
  "found_another",
  "other",
];

/** ТЗ п.10.39 — причина из перечня плюс необязательный комментарий. */
export class CancelDealDto {
  @IsIn(CANCEL_REASONS)
  reason!: DealCancelReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
