import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";
import type { ListingKind } from "../../listings/listings.types.js";

export class CreateSubscriptionDto {
  @IsUUID()
  fromCityId!: string;

  @IsUUID()
  toCityId!: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Не задано — подписка на оба типа объявлений (ТЗ п.8.10). */
  @IsOptional()
  @IsIn(["trip", "request"])
  listingType?: ListingKind;
}
