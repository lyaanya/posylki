import { IsUUID } from "class-validator";

/** ТЗ п.10.1 — сделка создаётся откликнувшимся участником существующего чата (E09). */
export class CreateDealDto {
  @IsUUID()
  chatId!: string;
}
