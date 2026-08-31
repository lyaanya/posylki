import { IsUUID } from "class-validator";

export class SetReferrerDto {
  @IsUUID()
  referrerId!: string;
}
