import { IsDateString, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

/** ТЗ E04 — минимальная подача заявки: тип документа ссылается на справочник document_types (E05). */
export class SubmitVerificationDto {
  @IsUUID()
  documentType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  /** Сырой номер документа — хэшируется на сервере, в открытом виде никогда не сохраняется (16.20). */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentNumber!: string;

  /** Путь из ответа POST /verification/photos. */
  @IsString()
  documentPhotoPath!: string;

  @IsString()
  selfiePhotoPath!: string;
}
