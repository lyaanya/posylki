import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";
import { AppException } from "./app-exception.js";
import { fallbackCodeFor } from "./http-status-codes.js";

/**
 * Единый формат ответа об ошибке для всех эндпоинтов (E01 п. 1.19):
 * { error: { code, message, details } }.
 *
 * Ловит вообще всё — не только HttpException, — чтобы непойманная
 * ошибка в сервисе тоже вернулась клиенту в этом формате, а не как
 * голый текст стектрейса или пустой ответ.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details ?? {},
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);

      response.status(status).json({
        error: {
          code: fallbackCodeFor(status),
          message: Array.isArray(message) ? message.join("; ") : message,
          details: {},
        },
      });
      return;
    }

    // Незнакомая ошибка — не наша HttpException. Наружу уходит нейтральный
    // текст, подробности только в серверном логе (см. E01 п. 1.23: логи
    // не должны превращаться в утечку внутренностей).
    this.logger.error(exception instanceof Error ? exception.stack : exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Внутренняя ошибка сервера",
        details: {},
      },
    });
  }
}
