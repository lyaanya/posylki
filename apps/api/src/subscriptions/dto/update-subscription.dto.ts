import { IsBoolean } from "class-validator";

/** ТЗ п.8.13 — подписку можно только включить/выключить, не отредактировать маршрут. */
export class UpdateSubscriptionDto {
  @IsBoolean()
  isActive!: boolean;
}
