import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateCurrencyDto {
  @IsString()
  @MinLength(3)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  symbol!: string;

  @IsInt()
  @Min(0)
  @Max(4)
  decimalPlaces!: number;
}

export class UpdateCurrencyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  symbol?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  decimalPlaces?: number;
}
