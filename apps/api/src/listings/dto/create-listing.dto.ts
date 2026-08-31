import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import type { ListingKind } from "../listings.types.js";

/**
 * Одна DTO на оба типа объявления, а не две отдельных: поля рейса и заявки
 * почти не пересекаются (ТЗ п.7.1 / 7.5), обязательность каждого зависит
 * от type — проверяется @ValidateIf, а не двумя разными классами тела
 * запроса на один и тот же маршрут.
 */
export class CreateListingDto {
  @IsIn(["trip", "request"])
  type!: ListingKind;

  @IsUUID()
  fromCityId!: string;

  @IsUUID()
  toCityId!: string;

  @IsUUID()
  currencyId!: string;

  /** Рейс: дата вылета. Заявка: начало желаемого диапазона. */
  @IsDateString()
  dateFrom!: string;

  /** Рейс: дата прилёта. Заявка: конец желаемого диапазона. */
  @IsDateString()
  dateTo!: string;

  /** Кратность 500 г проверяется в контроллере — там же округление вверх с клиента. */
  @IsNumber()
  @Min(0.5)
  @Max(30)
  weightKg!: number;

  @ValidateIf((o: CreateListingDto) => o.type === "trip")
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  pricePerKg?: number;

  @ValidateIf((o: CreateListingDto) => o.type === "trip")
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  minPrice?: number;

  /** Заявка: цена общей суммой вместо ставки за кг — взаимоисключающе с pricePerKg. */
  @ValidateIf((o: CreateListingDto) => o.type === "request" && o.pricePerKg === undefined)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  priceTotal?: number;

  @ValidateIf((o: CreateListingDto) => o.type === "trip")
  @IsString()
  @MaxLength(500)
  pickupInstructions?: string;

  @ValidateIf((o: CreateListingDto) => o.type === "trip")
  @IsString()
  @MaxLength(500)
  dropoffInstructions?: string;

  /** Рейс: по умолчанию dateTo + 7 дней, считается в контроллере, если не задано. */
  @IsOptional()
  @IsDateString()
  storageUntilDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departureAirport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  arrivalAirport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  flightNumber?: string;

  /** Заявка: краткое публичное описание груза — обязательно (ТЗ п.7.5). */
  @ValidateIf((o: CreateListingDto) => o.type === "request")
  @IsString()
  @MaxLength(300)
  itemDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
