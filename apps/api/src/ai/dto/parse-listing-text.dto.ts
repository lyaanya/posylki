import { IsString, MaxLength, MinLength } from "class-validator";

export class ParseListingTextDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  text!: string;
}
