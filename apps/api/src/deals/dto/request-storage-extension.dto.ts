import { IsDateString } from "class-validator";

/** ТЗ п.10.32 — запрашивает заказчик, решает курьер, автопродления нет никогда. */
export class RequestStorageExtensionDto {
  @IsDateString()
  requestedUntilDate!: string;
}
