import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { DirectoriesModule } from "../directories/directories.module.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { AI_REQUEST_LOG_REPOSITORY } from "./ai-request-log.repository.js";
import { SupabaseAiRequestLogRepository } from "./ai-request-log.repository.supabase.js";
import { MODERATION_RESULTS_REPOSITORY } from "./moderation-results.repository.js";
import { SupabaseModerationResultsRepository } from "./moderation-results.repository.supabase.js";
import { InventoryModerationScenario } from "./scenarios/inventory-moderation.scenario.js";
import { ListingModerationScenario } from "./scenarios/listing-moderation.scenario.js";
import { ParseListingTextScenario } from "./scenarios/parse-listing-text.scenario.js";

@Module({
  imports: [DirectoriesModule, AdminModule],
  controllers: [AiController],
  providers: [
    AiService,
    ParseListingTextScenario,
    InventoryModerationScenario,
    ListingModerationScenario,
    { provide: AI_REQUEST_LOG_REPOSITORY, useClass: SupabaseAiRequestLogRepository },
    { provide: MODERATION_RESULTS_REPOSITORY, useClass: SupabaseModerationResultsRepository },
  ],
  exports: [
    AiService,
    InventoryModerationScenario,
    ListingModerationScenario,
    MODERATION_RESULTS_REPOSITORY,
    AI_REQUEST_LOG_REPOSITORY,
  ],
})
export class AiModule {}
