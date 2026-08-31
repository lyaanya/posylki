import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import type { ComplaintCategory, ComplaintTargetType } from "../moderation.types.js";

const TARGET_TYPES: ComplaintTargetType[] = ["user", "message", "listing", "review", "deal"];
const CATEGORIES: ComplaintCategory[] = [
  "fraud",
  "prohibited_item",
  "rudeness",
  "breach_of_agreement",
  "fake_documents",
  "spam",
  "other",
];

/** ТЗ п.12.1-12.4 — жалоба на один из пяти типов объектов. */
export class CreateComplaintDto {
  @IsIn(TARGET_TYPES)
  targetType!: ComplaintTargetType;

  @IsUUID()
  targetId!: string;

  @IsIn(CATEGORIES)
  category!: ComplaintCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photoPaths?: string[];
}
