import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/** ТЗ п.10.10 — позиция описи: название, количество, ориентировочный вес (необязательно, из справочника E05). */
export class AddDealItemDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  weightKg?: number;
}
