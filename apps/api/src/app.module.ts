import path from "node:path";
import { fileURLToPath } from "node:url";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuditLogModule } from "./audit-log/audit-log.module.js";
import { validateEnv } from "./config/env.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { LoggerModule } from "./logging/logger.module.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * .env читается из корня репозитория, а не из cwd процесса: команды
 * запускаются то из корня, то из apps/api, и единый файл окружения
 * не должен зависеть от того, откуда стартовали.
 */
const rootEnvFilePath = path.resolve(currentDir, "../../../.env");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: rootEnvFilePath,
    }),
    LoggerModule,
    DatabaseModule,
    AuditLogModule,
    HealthModule,
  ],
})
export class AppModule {}
