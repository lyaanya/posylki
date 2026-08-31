import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSupportFaqDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  answer!: string;
}

export class UpdateSupportFaqDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  question?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  answer?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
