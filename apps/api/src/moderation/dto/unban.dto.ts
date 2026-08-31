import { IsString, MaxLength, MinLength } from "class-validator";

/** ТЗ п.12.19 — разблокировка требует причины. */
export class UnbanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
