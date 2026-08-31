import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module.js";
import { DirectoriesModule } from "../directories/directories.module.js";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module.js";
import { ListingsArchiveService } from "./listings-archive.service.js";
import { ListingsController } from "./listings.controller.js";
import { LISTINGS_REPOSITORY } from "./listings.repository.js";
import { SupabaseListingsRepository } from "./listings.repository.supabase.js";

@Module({
  imports: [DirectoriesModule, SubscriptionsModule, AiModule],
  controllers: [ListingsController],
  providers: [
    { provide: LISTINGS_REPOSITORY, useClass: SupabaseListingsRepository },
    ListingsArchiveService,
  ],
  exports: [LISTINGS_REPOSITORY],
})
export class ListingsModule {}
