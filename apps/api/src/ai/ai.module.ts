import { Module } from "@nestjs/common";
import { DirectoriesModule } from "../directories/directories.module.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { AI_REQUEST_LOG_REPOSITORY } from "./ai-request-log.repository.js";
import { SupabaseAiRequestLogRepository } from "./ai-request-log.repository.supabase.js";
import { ParseListingTextScenario } from "./scenarios/parse-listing-text.scenario.js";

@Module({
  imports: [DirectoriesModule],
  controllers: [AiController],
  providers: [
    AiService,
    ParseListingTextScenario,
    { provide: AI_REQUEST_LOG_REPOSITORY, useClass: SupabaseAiRequestLogRepository },
  ],
  exports: [AiService],
})
export class AiModule {}
