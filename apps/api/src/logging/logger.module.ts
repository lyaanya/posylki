import { Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { REDACT_CENSOR, REDACT_PATHS } from "./redaction.js";

/**
 * Структурное JSON-логирование (E01 п. 1.22–1.23):
 * - каждая запись несёт метку времени, уровень, id запроса, сообщение;
 * - redact вычищает значения по известным именам ключей секретов (см.
 *   redaction.ts) — так их не увидит журнал, даже если кто-то случайно
 *   залогирует целый объект с токеном внутри;
 * - тело запроса не логируется вовсе (pino-http по умолчанию логирует
 *   только метод/путь/статус/время), поэтому текст сообщений чата и
 *   персональные данные верификации в логи не попадают структурно,
 *   а не только по счастливой случайности.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: IncomingMessage) => {
          const header = req.headers["x-request-id"];
          return typeof header === "string" ? header : randomUUID();
        },
        redact: {
          paths: REDACT_PATHS,
          censor: REDACT_CENSOR,
        },
        customProps: (req) => ({
          userId: (req as IncomingMessage & { userId?: string }).userId ?? null,
        }),
        // Тело запроса намеренно не сериализуется (см. комментарий выше).
        serializers: {
          req: (req: IncomingMessage) => ({
            method: req.method,
            url: req.url,
          }),
        },
      },
    }),
  ],
})
export class LoggerModule {}
