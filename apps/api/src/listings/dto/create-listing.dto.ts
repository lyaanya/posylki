import { IsDateString, IsIn, IsNumber, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import type { ListingKind } from "../listings.types.js";

export class CreateListingDto {
  @IsIn(["trip", "request"])
  type!: ListingKind;

  @IsUUID()
  fromCityId!: string;

  @IsUUID()
  toCityId!: string;

  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0.1)
  @Max(1000)
  freeWeightKg!: number;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  pricePerKg!: number;

  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  minPrice!: number;

  @IsString()
  @MaxLength(2000)
  description: string = "";
}
