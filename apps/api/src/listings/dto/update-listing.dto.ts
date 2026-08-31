import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

/**
 * Правила заморозки полей после первой сделки (ТЗ п.7.19-7.22) здесь не
 * применяются: сделок (E10) ещё нет, поэтому "заморозки из-за сделки" пока
 * не бывает — до E10 автор может редактировать любое поле. Тип объявления
 * не редактируется — смена рейс↔заявка не входит в ТЗ.
 */
export class UpdateListingDto {
  @IsOptional()
  @IsUUID()
  fromCityId?: string;

  @IsOptional()
  @IsUUID()
  toCityId?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(30)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  pricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  priceTotal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dropoffInstructions?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(300)
  itemDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
