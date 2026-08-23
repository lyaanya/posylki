import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateDocumentTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(2)
  countryCode!: string;

  @IsOptional()
  @IsString()
  numberPattern?: string | null;
}

export class UpdateDocumentTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  numberPattern?: string | null;
}
