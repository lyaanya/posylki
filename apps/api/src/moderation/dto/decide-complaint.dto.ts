import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import type { ModerationAction } from "../moderation.types.js";

const ACTIONS: ModerationAction[] = ["reject", "warn", "hide_listing", "remove_review", "ban_user"];

/** ТЗ п.12.10 — пять типов решений по жалобе. Цель (пользователь/объявление/отзыв) сервер сам определяет по цели жалобы. */
export class DecideComplaintDto {
  @IsIn(ACTIONS)
  action!: ModerationAction;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  /** Только для ban_user — сколько дней блокировка; не указано/0 — бессрочно (ТЗ п.12.14). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  banDurationDays?: number;
}
