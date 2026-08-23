import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";

/**
 * Общая конфигурация приложения для main.ts и для e2e-тестов — чтобы тест
 * проверял ровно ту настройку (фильтр исключений, валидация, логгер), что
 * реально работает в бою, а не отдельную копию, которая может незаметно
 * разойтись. NestFactory.create должен вызываться с { bufferLogs: true },
 * иначе логи стартапа до useLogger() уйдут через стандартный вывод Nest,
 * а не через структурный JSON.
 */
export function configureApp(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  // Клиенты (web, admin, мобильное приложение) ходят напрямую с браузера/
  // устройства без cookie-сессии (авторизация — Bearer-токен в заголовке),
  // поэтому открытый CORS не создаёт CSRF-риска.
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
