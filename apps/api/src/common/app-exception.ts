import { HttpException, type HttpStatus } from "@nestjs/common";

/**
 * Базовое исключение приложения. В отличие от стандартных исключений Nest,
 * несёт машиночитаемый code (см. E01 п. 1.19) — по нему клиент отличает
 * "нужна верификация" от "неверный формат данных", не парся текст.
 */
export class AppException extends HttpException {
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;

  constructor(params: {
    code: string;
    message: string;
    status: HttpStatus;
    details?: Record<string, unknown>;
  }) {
    super(params.message, params.status);
    this.code = params.code;
    this.details = params.details;
  }
}
