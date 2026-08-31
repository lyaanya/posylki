import { IsIn, IsString, MaxLength } from "class-validator";
import type { ContactEvent, ContactRole } from "../deals.types.js";

/** ТЗ п.10.22-10.23 — контакт на конкретное событие и сторону, по умолчанию заполняется самим участником. */
export class SetDealContactDto {
  @IsIn(["handover", "pickup"])
  event!: ContactEvent;

  @IsIn(["customer", "courier"])
  role!: ContactRole;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;
}
