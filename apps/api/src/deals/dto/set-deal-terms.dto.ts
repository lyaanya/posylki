import { IsNumber, IsOptional, Max, Min } from "class-validator";

/**
 * ТЗ п.10.5-10.6 — заявленный вес и итоговая цена, обязательны для перехода
 * в agreed. Изменение любого из них после первого согласования сбрасывает
 * подтверждения обеих сторон (deals.controller.ts, confirmTerms).
 */
export class SetDealTermsDto {
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(30)
  declaredWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  price?: number;
}
