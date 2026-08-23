import path from "node:path";
import { fileURLToPath } from "node:url";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module.js";
import { AiModule } from "./ai/ai.module.js";
import { AuditLogModule } from "./audit-log/audit-log.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { validateEnv } from "./config/env.js";
import { DatabaseModule } from "./database/database.module.js";
import { DirectoriesModule } from "./directories/directories.module.js";
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
    AuthModule,
    AdminModule,
    DirectoriesModule,
    AiModule,
    HealthModule,
  ],
})
export class AppModule {}
