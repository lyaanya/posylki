import { IsIn, IsOptional, IsUUID } from "class-validator";
import type { ListingKind } from "../listings.types.js";

export class SearchListingsQueryDto {
  @IsOptional()
  @IsIn(["trip", "request"])
  type?: ListingKind;

  @IsOptional()
  @IsUUID()
  fromCityId?: string;

  @IsOptional()
  @IsUUID()
  toCityId?: string;
}
