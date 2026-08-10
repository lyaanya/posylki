import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { REDACT_CENSOR, REDACT_PATHS } from "./redaction.js";

/**
 * Проверяет ровно ту конфигурацию редактирования, что использует
 * LoggerModule (импортирует те же REDACT_PATHS, не копию) — на реальном
 * pino, а не на моке, чтобы тест ловил и ошибки в синтаксисе путей.
 */
function createCapturingLogger(): { logger: pino.Logger; output: () => string } {
  let buffer = "";
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      buffer += chunk.toString("utf8");
      callback();
    },
  });

  const logger = pino(
    {
      redact: { paths: REDACT_PATHS, censor: REDACT_CENSOR },
    },
    stream,
  );

  return { logger, output: () => buffer };
}

describe("редактирование секретов в логах (E01 п. 1.23)", () => {
  it("вычищает пароль и не выводит его значение", () => {
    const { logger, output } = createCapturingLogger();

    logger.info({ user: { password: "supersecret123" } }, "тестовое сообщение");

    expect(output()).not.toContain("supersecret123");
    expect(output()).toContain(REDACT_CENSOR);
  });

  it("вычищает значения известных секретов Supabase", () => {
    const { logger, output } = createCapturingLogger();

    logger.info(
      { config: { SUPABASE_SERVICE_KEY: "eyJ-настоящий-ключ-не-должен-утечь" } },
      "конфигурация",
    );

    expect(output()).not.toContain("настоящий-ключ-не-должен-утечь");
  });

  it("вычищает заголовок Authorization", () => {
    const { logger, output } = createCapturingLogger();

    logger.info({ req: { headers: { authorization: "Bearer secret-jwt-token" } } }, "запрос");

    expect(output()).not.toContain("secret-jwt-token");
  });

  it("не трогает обычные, не секретные поля", () => {
    const { logger, output } = createCapturingLogger();

    logger.info({ action: "user.block", entityType: "user" }, "обычная запись");

    expect(output()).toContain("user.block");
    expect(output()).toContain("entityType");
  });
});
