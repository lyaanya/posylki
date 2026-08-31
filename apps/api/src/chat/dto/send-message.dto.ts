import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

const MAX_ATTACHMENTS = 5;

/** ТЗ E09 п.9.7 — до 4000 символов текста, до 5 фотографий на сообщение. */
export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  /** Пути из ответа POST /chats/attachments (см. chat-attachment-storage.ts), не сами файлы. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @IsString({ each: true })
  attachmentPaths?: string[];
}
