import { IsString, MaxLength, MinLength } from "class-validator";

/** ТЗ п.11.14/11.16 — удалить можно только с причиной, она попадает в audit_log. */
export class ModerateReviewDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
