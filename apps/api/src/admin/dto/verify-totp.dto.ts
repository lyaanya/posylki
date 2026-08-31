import { IsOptional, IsString, Length } from "class-validator";

export class VerifyTotpDto {
  @IsString()
  @Length(6, 6)
  code!: string;

  /**
   * Возвращается клиенту из /totp/setup и передаётся обратно первым
   * вызовом /verify — секрет ещё не сохранён в БД до подтверждения
   * рабочим кодом, поэтому единственное его временное хранилище — сам
   * клиент. На все последующие входы это поле не нужно.
   */
  @IsOptional()
  @IsString()
  pendingSecret?: string;
}
