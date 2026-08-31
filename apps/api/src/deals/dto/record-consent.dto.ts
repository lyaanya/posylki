import { IsIn } from "class-validator";
import type { ConsentType } from "../deals.types.js";

/** ТЗ п.10.13 / 13.19 — согласие со стоп-листом и/или ознакомление с предупреждением ИИ. */
export class RecordConsentDto {
  @IsIn(["stop_list", "item_warning"])
  type!: ConsentType;
}
