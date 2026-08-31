import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

const ACTIONS = ["warn", "ban_user", "unban"] as const;
export type ModerateUserAction = (typeof ACTIONS)[number];

/** ТЗ E16 п.16.19 — действия над пользователем из его карточки, причина обязательна для всех трёх. */
export class ModerateUserDto {
  @IsIn(ACTIONS)
  action!: ModerateUserAction;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  /** Только для ban_user — не указано/0 значит бессрочно (как и в decide-complaint.dto.ts). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  banDurationDays?: number;
}
