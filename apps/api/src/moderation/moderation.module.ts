import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { AiModule } from "../ai/ai.module.js";
import { AuditLogModule } from "../audit-log/audit-log.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ChatModule } from "../chat/chat.module.js";
import { DealsModule } from "../deals/deals.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ProfileModule } from "../profile/profile.module.js";
import { ReviewsModule } from "../reviews/reviews.module.js";
import { AdminModerationController } from "./admin-moderation.controller.js";
import { AdminUsersController } from "../admin/admin-users.controller.js";
import { BANS_REPOSITORY } from "./bans.repository.js";
import { SupabaseBansRepository } from "./bans.repository.supabase.js";
import { COMPLAINT_PHOTO_STORAGE } from "./complaint-photo-storage.js";
import { SupabaseComplaintPhotoStorage } from "./complaint-photo-storage.supabase.js";
import { COMPLAINTS_REPOSITORY } from "./complaints.repository.js";
import { SupabaseComplaintsRepository } from "./complaints.repository.supabase.js";
import { ModerationActionsService } from "./moderation-actions.service.js";
import { ModerationController } from "./moderation.controller.js";
import { ModerationCronService } from "./moderation-cron.service.js";
import { MODERATION_DECISIONS_REPOSITORY } from "./moderation-decisions.repository.js";
import { SupabaseModerationDecisionsRepository } from "./moderation-decisions.repository.supabase.js";
import { WARNINGS_REPOSITORY } from "./warnings.repository.js";
import { SupabaseWarningsRepository } from "./warnings.repository.supabase.js";

@Module({
  imports: [
    AdminModule,
    AiModule,
    AuditLogModule,
    AuthModule,
    ChatModule,
    DealsModule,
    ListingsModule,
    ProfileModule,
    ReviewsModule,
    NotificationsModule,
  ],
  controllers: [ModerationController, AdminModerationController, AdminUsersController],
  providers: [
    { provide: COMPLAINTS_REPOSITORY, useClass: SupabaseComplaintsRepository },
    { provide: COMPLAINT_PHOTO_STORAGE, useClass: SupabaseComplaintPhotoStorage },
    { provide: WARNINGS_REPOSITORY, useClass: SupabaseWarningsRepository },
    { provide: BANS_REPOSITORY, useClass: SupabaseBansRepository },
    { provide: MODERATION_DECISIONS_REPOSITORY, useClass: SupabaseModerationDecisionsRepository },
    ModerationActionsService,
    ModerationCronService,
  ],
  exports: [COMPLAINTS_REPOSITORY, BANS_REPOSITORY, WARNINGS_REPOSITORY],
})
export class ModerationModule {}
