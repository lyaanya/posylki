import { IsDateString, IsIn, IsString, MinLength } from "class-validator";
import type { LegalDocumentType } from "../../auth/auth.types.js";

const TYPES: LegalDocumentType[] = ["terms", "privacy", "service_rules", "consent"];

/** ТЗ E16 п.16.29 — публикация новой версии; версия и id вычисляются сервером. */
export class PublishLegalDocumentDto {
  @IsIn(TYPES)
  type!: LegalDocumentType;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  bodyMarkdown!: string;

  @IsDateString()
  effectiveAt!: string;
}
