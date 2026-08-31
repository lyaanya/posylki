import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

/** ТЗ п.11.9 — оценка обязательна, текст необязателен. Роль/субъект сервер определяет сам по сделке. */
export class CreateReviewDto {
  @IsUUID()
  dealId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;
}
