import { Module } from "@nestjs/common";
import { DirectoriesModule } from "../directories/directories.module.js";
import { SubscriptionsController } from "./subscriptions.controller.js";
import { SUBSCRIPTIONS_REPOSITORY } from "./subscriptions.repository.js";
import { SupabaseSubscriptionsRepository } from "./subscriptions.repository.supabase.js";

@Module({
  imports: [DirectoriesModule],
  controllers: [SubscriptionsController],
  providers: [{ provide: SUBSCRIPTIONS_REPOSITORY, useClass: SupabaseSubscriptionsRepository }],
  exports: [SUBSCRIPTIONS_REPOSITORY],
})
export class SubscriptionsModule {}
