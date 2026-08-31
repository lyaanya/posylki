import { IsBoolean, IsOptional } from "class-validator";

/**
 * ТЗ п.14.8 — группы "сделки" здесь намеренно нет: её нельзя отключить, и
 * этот DTO просто не даёт такой возможности вместо runtime-проверки.
 */
export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  messagesPush?: boolean;

  @IsOptional()
  @IsBoolean()
  messagesEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  messagesTelegram?: boolean;

  @IsOptional()
  @IsBoolean()
  listingsPush?: boolean;

  @IsOptional()
  @IsBoolean()
  listingsEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  listingsTelegram?: boolean;

  @IsOptional()
  @IsBoolean()
  servicePush?: boolean;

  @IsOptional()
  @IsBoolean()
  serviceEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  serviceTelegram?: boolean;
}
