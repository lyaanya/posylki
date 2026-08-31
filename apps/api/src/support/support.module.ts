import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { ChatModule } from "../chat/chat.module.js";
import { DealsModule } from "../deals/deals.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AdminSupportController } from "./admin-support.controller.js";
import { SUPPORT_FAQ_REPOSITORY } from "./support-faq.repository.js";
import { SupabaseSupportFaqRepository } from "./support-faq.repository.supabase.js";
import { SUPPORT_TICKETS_REPOSITORY } from "./support-tickets.repository.js";
import { SupabaseSupportTicketsRepository } from "./support-tickets.repository.supabase.js";
import { SupportController } from "./support.controller.js";
import { SupportService } from "./support.service.js";

@Module({
  imports: [ChatModule, DealsModule, ListingsModule, AdminModule, NotificationsModule],
  controllers: [SupportController, AdminSupportController],
  providers: [
    SupportService,
    { provide: SUPPORT_TICKETS_REPOSITORY, useClass: SupabaseSupportTicketsRepository },
    { provide: SUPPORT_FAQ_REPOSITORY, useClass: SupabaseSupportFaqRepository },
  ],
  exports: [SUPPORT_TICKETS_REPOSITORY],
})
export class SupportModule {}
