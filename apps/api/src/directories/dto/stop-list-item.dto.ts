import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateStopListItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  countryCode?: string | null;
}

export class UpdateStopListItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  countryCode?: string | null;
}
