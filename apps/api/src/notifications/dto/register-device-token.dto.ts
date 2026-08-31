import { IsIn, IsString, MinLength } from "class-validator";

export class RegisterDeviceTokenDto {
  @IsIn(["ios", "android"])
  platform!: "ios" | "android";

  @IsString()
  @MinLength(8)
  token!: string;
}
