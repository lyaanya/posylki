import "reflect-metadata";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SwaggerParser from "@apidevtools/swagger-parser";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import prettier from "prettier";
import { AppModule } from "./app.module.js";
import { buildOpenApiConfig } from "./openapi-config.js";

/**
 * Экспортирует OpenAPI-документ, порождённый декораторами контроллеров,
 * в packages/contracts/openapi.json — статический источник правды для
 * генерации типов веба, iOS и Android (E01 п. 1.17–1.18). Валидирует
 * результат, чтобы сломанная спецификация не попала в репозиторий.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(currentDir, "../../../packages/contracts/openapi.json");

  // Форматируем через Prettier тем же конфигом, что и pnpm format:check —
  // иначе каждая регенерация отличается от закоммиченного файла только
  // пробелами, и проверка актуальности (E01 п. 1.26) ложно падает на пустом месте.
  const prettierConfig = await prettier.resolveConfig(outPath);
  const formatted = await prettier.format(JSON.stringify(document, null, 2), {
    ...prettierConfig,
    parser: "json",
  });

  await writeFile(outPath, formatted, "utf8");

  await SwaggerParser.validate(structuredClone(document) as never);

  console.log(`Спецификация записана и провалидирована: ${outPath}`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("Не удалось сгенерировать OpenAPI-спецификацию:", error);
  process.exit(1);
});
