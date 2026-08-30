import { Module } from "@nestjs/common";
import { DirectoriesModule } from "../directories/directories.module.js";
import { ListingsController } from "./listings.controller.js";
import { LISTINGS_REPOSITORY } from "./listings.repository.js";
import { SupabaseListingsRepository } from "./listings.repository.supabase.js";

@Module({
  imports: [DirectoriesModule],
  controllers: [ListingsController],
  providers: [{ provide: LISTINGS_REPOSITORY, useClass: SupabaseListingsRepository }],
  exports: [LISTINGS_REPOSITORY],
})
export class ListingsModule {}
