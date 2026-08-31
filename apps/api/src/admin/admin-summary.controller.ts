import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AI_REQUEST_LOG_REPOSITORY, type IAiRequestLogRepository } from "../ai/ai-request-log.repository.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "../deals/deals.repository.js";
import { COMPLAINTS_REPOSITORY, type IComplaintsRepository } from "../moderation/complaints.repository.js";
import {
  SUPPORT_TICKETS_REPOSITORY,
  type ISupportTicketsRepository,
} from "../support/support-tickets.repository.js";
import {
  VERIFICATION_REQUESTS_REPOSITORY,
  type IVerificationRequestsRepository,
} from "../verification/verification-requests.repository.js";
import { AdminGuard } from "./admin.guard.js";

/**
 * ТЗ E16 пп.16.30-16.31 — главный экран: операционные показатели этапа и
 * расходы на ИИ-сервис за период. Продуктовой аналитики намеренно нет
 * (16.32 — в бэклоге по решению заказчика).
 */
@ApiTags("admin/summary")
@UseGuards(AdminGuard)
@Controller("admin/summary")
export class AdminSummaryController {
  constructor(
    @Inject(VERIFICATION_REQUESTS_REPOSITORY) private readonly verificationRequests: IVerificationRequestsRepository,
    @Inject(COMPLAINTS_REPOSITORY) private readonly complaints: IComplaintsRepository,
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(SUPPORT_TICKETS_REPOSITORY) private readonly supportTickets: ISupportTicketsRepository,
    @Inject(AI_REQUEST_LOG_REPOSITORY) private readonly aiRequestLog: IAiRequestLogRepository,
  ) {}

  @Get()
  async summary(@Query("from") from?: string, @Query("to") to?: string) {
    const [verificationQueue, complaintsQueue, problemDeals, openTickets] = await Promise.all([
      this.verificationRequests.findQueue(),
      this.complaints.findQueue(),
      this.deals.findByStatus("problem"),
      this.supportTickets.findQueue(),
    ]);

    const now = Date.now();
    const waitingMinutes = verificationQueue.map((r) => (now - r.createdAt.getTime()) / 60_000);
    const averageWaitingMinutes =
      waitingMinutes.length > 0 ? Math.round(waitingMinutes.reduce((a, b) => a + b, 0) / waitingMinutes.length) : 0;

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const aiUsage = await this.aiRequestLog.getUsageSummary(fromDate, toDate);

    return {
      verificationQueueCount: verificationQueue.length,
      averageVerificationWaitingMinutes: averageWaitingMinutes,
      moderationQueueCount: complaintsQueue.length + problemDeals.length,
      openSupportTicketsCount: openTickets.length,
      problemDealsCount: problemDeals.length,
      aiUsage,
    };
  }
}
