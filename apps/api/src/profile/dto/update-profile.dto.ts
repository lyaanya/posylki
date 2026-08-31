import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

/**
 * ТЗ E06 п.6.9: имя и фамилия должны приходить только из проверенного
 * документа (E04) и не редактироваться пользователем напрямую. E04 в этой
 * итерации сознательно не реализован (то же решение, что и для гейта
 * верификации при публикации объявлений — см. listings.controller.ts),
 * поэтому displayName здесь временно редактируется вручную — до появления
 * верификации.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  aboutText?: string | null;

  @IsOptional()
  @IsUUID()
  cityId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  avatarUrl?: string | null;
}
