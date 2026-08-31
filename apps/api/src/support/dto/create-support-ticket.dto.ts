import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import type { SupportLinkedObjectType } from "../support.types.js";

const LINKED_OBJECT_TYPES: SupportLinkedObjectType[] = ["deal", "listing", "verification"];

/** ТЗ п.15.1/15.5 — кнопка «написать в поддержку» из карточки сделки/объявления передаёт привязку явно. */
export class CreateSupportTicketDto {
  @IsOptional()
  @IsIn(LINKED_OBJECT_TYPES)
  linkedObjectType?: SupportLinkedObjectType;

  @IsOptional()
  @IsUUID()
  linkedObjectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  /** ТЗ п.15.4 — заполняется, если обращение открыто с экрана ошибки. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lastError?: string;
}
