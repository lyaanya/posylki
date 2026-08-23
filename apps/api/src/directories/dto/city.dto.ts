import { IsArray, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateCityDto {
  @IsString()
  @MinLength(1)
  nameRu!: string;

  @IsString()
  @MinLength(1)
  nameEn!: string;

  @IsString()
  @MinLength(2)
  countryCode!: string;

  @IsString()
  @MinLength(1)
  timezone!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];
}

export class UpdateCityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nameRu?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];
}
