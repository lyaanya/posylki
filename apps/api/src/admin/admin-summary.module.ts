import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { DealsModule } from "../deals/deals.module.js";
import { ModerationModule } from "../moderation/moderation.module.js";
import { SupportModule } from "../support/support.module.js";
import { VerificationModule } from "../verification/verification.module.js";
import { AdminModule } from "./admin.module.js";
import { AdminSummaryController } from "./admin-summary.controller.js";

/**
 * Сводка (E16 пп.16.30-16.31) тянет данные из пяти разных модулей —
 * отдельный модуль сверху, а не расширение AdminModule: сам AdminModule
 * уже импортируется каждым из них (guard, роли, сессии), и обратный
 * импорт создал бы циклическую зависимость.
 */
@Module({
  imports: [VerificationModule, ModerationModule, DealsModule, SupportModule, AiModule, AdminModule],
  controllers: [AdminSummaryController],
})
export class AdminSummaryModule {}
