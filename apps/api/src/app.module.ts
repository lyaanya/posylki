import path from "node:path";
import { fileURLToPath } from "node:url";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AdminModule } from "./admin/admin.module.js";
import { AdminSummaryModule } from "./admin/admin-summary.module.js";
import { AiModule } from "./ai/ai.module.js";
import { AuditLogModule } from "./audit-log/audit-log.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { validateEnv } from "./config/env.js";
import { DatabaseModule } from "./database/database.module.js";
import { DealsModule } from "./deals/deals.module.js";
import { DirectoriesModule } from "./directories/directories.module.js";
import { HealthModule } from "./health/health.module.js";
import { ListingsModule } from "./listings/listings.module.js";
import { LoggerModule } from "./logging/logger.module.js";
import { ChatModule } from "./chat/chat.module.js";
import { ModerationModule } from "./moderation/moderation.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { ProfileModule } from "./profile/profile.module.js";
import { ReviewsModule } from "./reviews/reviews.module.js";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module.js";
import { SupportModule } from "./support/support.module.js";
import { VerificationModule } from "./verification/verification.module.js";

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
    ScheduleModule.forRoot(),
    LoggerModule,
    DatabaseModule,
    AuditLogModule,
    AuthModule,
    AdminModule,
    DirectoriesModule,
    AiModule,
    ListingsModule,
    ProfileModule,
    SubscriptionsModule,
    ChatModule,
    DealsModule,
    ReviewsModule,
    ModerationModule,
    NotificationsModule,
    SupportModule,
    VerificationModule,
    AdminSummaryModule,
    HealthModule,
  ],
})
export class AppModule {}
