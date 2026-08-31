import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

const ACTIONS = ["reject", "warn", "ban_user"] as const;
export type ResolveDealAction = (typeof ACTIONS)[number];

/** ТЗ п.12.20-12.22 — разбор проблемной сделки без обязательной жалобы. */
export class ResolveDealDto {
  @IsIn(ACTIONS)
  action!: ResolveDealAction;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  /** Обязателен для warn/ban_user — у голой сделки нет "автора жалобы", чтобы определить сторону автоматически. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  banDurationDays?: number;
}
