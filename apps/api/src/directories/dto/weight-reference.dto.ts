import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateWeightReferenceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(0)
  weightGrams!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGramsMax?: number | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateWeightReferenceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightGramsMax?: number | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
