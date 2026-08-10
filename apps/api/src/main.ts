import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.js";
import { configureApp } from "./bootstrap.js";
import { buildOpenApiConfig } from "./openapi-config.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);
  const port = config.get("PORT", { infer: true });

  configureApp(app);

  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  SwaggerModule.setup("docs", app, document);

  await app.listen(port);

  const logger = new Logger("Bootstrap");
  logger.log(`API запущен на http://localhost:${port}`);
  logger.log(`Спецификация: http://localhost:${port}/docs`);
}

bootstrap();
