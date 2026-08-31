import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { AuditLogModule } from "../audit-log/audit-log.module.js";
import { ChatModule } from "../chat/chat.module.js";
import { DealsModule } from "../deals/deals.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AdminReviewsController } from "./admin-reviews.controller.js";
import { ReviewsController } from "./reviews.controller.js";
import { ReviewsCronService } from "./reviews-cron.service.js";
import { REVIEWS_REPOSITORY } from "./reviews.repository.js";
import { SupabaseReviewsRepository } from "./reviews.repository.supabase.js";

@Module({
  imports: [DealsModule, ChatModule, AdminModule, AuditLogModule, NotificationsModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [{ provide: REVIEWS_REPOSITORY, useClass: SupabaseReviewsRepository }, ReviewsCronService],
  exports: [REVIEWS_REPOSITORY],
})
export class ReviewsModule {}
