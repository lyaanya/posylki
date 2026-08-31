import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { AiModule } from "../ai/ai.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ChatModule } from "../chat/chat.module.js";
import { DirectoriesModule } from "../directories/directories.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ProfileModule } from "../profile/profile.module.js";
import { AdminDealsController } from "./admin-deals.controller.js";
import { DEAL_PHOTO_STORAGE } from "./deal-photo-storage.js";
import { SupabaseDealPhotoStorage } from "./deal-photo-storage.supabase.js";
import { DealsController } from "./deals.controller.js";
import { DealsCronService } from "./deals-cron.service.js";
import { DEALS_REPOSITORY } from "./deals.repository.js";
import { SupabaseDealsRepository } from "./deals.repository.supabase.js";
import { DealsTransitionsService } from "./deals-transitions.service.js";

@Module({
  imports: [
    AuthModule,
    ChatModule,
    ListingsModule,
    DirectoriesModule,
    ProfileModule,
    AiModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [DealsController, AdminDealsController],
  providers: [
    { provide: DEALS_REPOSITORY, useClass: SupabaseDealsRepository },
    { provide: DEAL_PHOTO_STORAGE, useClass: SupabaseDealPhotoStorage },
    DealsTransitionsService,
    DealsCronService,
  ],
  exports: [DEALS_REPOSITORY, DealsTransitionsService],
})
export class DealsModule {}
