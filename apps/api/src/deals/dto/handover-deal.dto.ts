import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

/** ТЗ п.10.14/10.26-10.29 — фактический вес необязателен, фотографий до 10, минимум одна (проверяется в контроллере). */
export class HandoverDealDto {
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(30)
  actualWeightKg?: number;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photoStoragePaths!: string[];
}
