import { IsBooleanString, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { PaginationQueryDto } from "../../common/pagination.js";
import type { ListingKind } from "../listings.types.js";

export type ListingSort = "date" | "price" | "rating";

export class SearchListingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["trip", "request"])
  type?: ListingKind;

  @IsOptional()
  @IsUUID()
  fromCityId?: string;

  @IsOptional()
  @IsUUID()
  toCityId?: string;

  /** E06 п. 6.1 — активные объявления пользователя на его публичном профиле. */
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  /** Диапазон дат (ТЗ п.8.5) — объявления, чьи даты пересекаются с этим диапазоном. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(30)
  weightMinKg?: number;

  /**
   * Требует currencyCode (проверяется в контроллере): без единой валюты
   * сравнивать "цена ≤ X" по строкам в разных валютах бессмысленно.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMaxPerKg?: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsBooleanString()
  verifiedOnly?: string;

  /** По цене (price) требует currencyCode — иначе сравнение между валютами (ТЗ п.8.7). */
  @IsOptional()
  @IsIn(["date", "price", "rating"])
  sortBy?: ListingSort;
}
