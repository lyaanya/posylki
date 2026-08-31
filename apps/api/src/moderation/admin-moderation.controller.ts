import { Body, Controller, Get, HttpStatus, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../admin/admin.guard.js";
import { CurrentAdmin } from "../admin/current-admin.decorator.js";
import type { AdminUser } from "../admin/admin-user.repository.js";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";
import { AppException } from "../common/app-exception.js";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import {
  MODERATION_RESULTS_REPOSITORY,
  type IModerationResultsRepository,
} from "../ai/moderation-results.repository.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "../deals/deals.repository.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "../listings/listings.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PROFILE_REPOSITORY, type IProfileRepository } from "../profile/profile.repository.js";
import { REVIEWS_REPOSITORY, type IReviewsRepository } from "../reviews/reviews.repository.js";
import { BANS_REPOSITORY, type IBansRepository } from "./bans.repository.js";
import { COMPLAINTS_REPOSITORY, type IComplaintsRepository } from "./complaints.repository.js";
import { DecideComplaintDto } from "./dto/decide-complaint.dto.js";
import { ResolveDealDto } from "./dto/resolve-deal.dto.js";
import { UnbanDto } from "./dto/unban.dto.js";
import {
  MODERATION_DECISIONS_REPOSITORY,
  type IModerationDecisionsRepository,
} from "./moderation-decisions.repository.js";
import { ModerationActionsService } from "./moderation-actions.service.js";
import type { Complaint, ComplaintTargetType } from "./moderation.types.js";

/**
 * Очередь модерации, разбор жалоб и проблемных сделок (ТЗ E12 пп.12.8-12.11,
 * 12.20-12.22). Общая очередь для жалоб и проблемных сделок, как и
 * помеченных ИИ объявлений (E13) — разделение избыточно при ожидаемом
 * объёме (тех. детали эпика).
 *
 * Настоящего интерфейса админ-панели (E16) нет — это только backend,
 * как и все admin-*.controller.ts в этом кодовой базе до сих пор.
 */
@ApiTags("admin/moderation")
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminModerationController {
  constructor(
    @Inject(COMPLAINTS_REPOSITORY) private readonly complaints: IComplaintsRepository,
    @Inject(MODERATION_DECISIONS_REPOSITORY) private readonly decisions: IModerationDecisionsRepository,
    @Inject(BANS_REPOSITORY) private readonly bans: IBansRepository,
    @Inject(PROFILE_REPOSITORY) private readonly profiles: IProfileRepository,
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(REVIEWS_REPOSITORY) private readonly reviews: IReviewsRepository,
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
    @Inject(ModerationActionsService) private readonly actions: ModerationActionsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(MODERATION_RESULTS_REPOSITORY) private readonly aiModerationResults: IModerationResultsRepository,
  ) {}

  /**
   * ТЗ п.16.12-16.13 — единая очередь модерации: жалобы (E12), проблемные
   * сделки (E10), объявления, помеченные ИИ (E13). Три структурно разных
   * источника нормализуются в общий вид для списка; открытие карточки
   * идёт через существующие узкоспециализированные эндпоинты каждого
   * источника (detailPath) — дублировать их полную логику здесь незачем.
   */
  @Get("moderation-queue")
  async unifiedQueue(): Promise<
    {
      id: string;
      source: "complaint" | "problem_deal" | "ai_flag";
      category: string | null;
      summary: string;
      createdAt: Date;
      detailPath: string;
    }[]
  > {
    const [complaints, problemDeals, aiFlags] = await Promise.all([
      this.complaints.findQueue(),
      this.deals.findByStatus("problem"),
      this.aiModerationResults.findPending(),
    ]);

    const complaintItems = complaints.map((c) => ({
      id: c.id,
      source: "complaint" as const,
      category: c.category,
      summary: `Жалоба (${c.targetType})`,
      createdAt: c.createdAt,
      detailPath: `/admin/complaints/${c.id}`,
    }));

    const dealItems = problemDeals.map((d) => ({
      id: d.id,
      source: "problem_deal" as const,
      category: null,
      summary: `Проблемная сделка ${d.fromCity} → ${d.toCity}`,
      createdAt: d.updatedAt,
      detailPath: `/admin/deals/${d.id}`,
    }));

    const aiItems = aiFlags
      .filter((r) => r.scenario === "listing_moderation")
      .map((r) => ({
        id: r.id,
        source: "ai_flag" as const,
        category: r.category,
        summary: r.explanation ?? "Объявление помечено ИИ на проверку",
        createdAt: r.createdAt,
        // Объявления не хранят чувствительных данных — публичной карточки
        // достаточно, отдельного admin-эндпоинта не заводим.
        detailPath: `/listings/${r.entityId}`,
      }));

    return [...complaintItems, ...dealItems, ...aiItems].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  @Get("complaints")
  async queue(): Promise<Complaint[]> {
    return this.complaints.findQueue();
  }

  @Get("complaints/:id")
  async detail(@Param("id") id: string) {
    const complaint = await this.requireComplaint(id);
    return this.buildContext(complaint);
  }

  /** ТЗ п.12.10-12.11 — пять решений, каждое пишется в moderation_decisions и audit_log. */
  @Post("complaints/:id/decide")
  async decide(
    @Param("id") id: string,
    @Body() dto: DecideComplaintDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<Complaint> {
    const complaint = await this.requireComplaint(id);
    const accusedUserId = await this.resolveAccusedUserId(complaint);

    if ((dto.action === "warn" || dto.action === "ban_user") && !accusedUserId) {
      throw new AppException({
        code: "CANNOT_RESOLVE_TARGET_USER",
        message: "Не удалось определить пользователя для этого решения",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (dto.action === "hide_listing" && complaint.targetType !== "listing") {
      throw new AppException({
        code: "WRONG_TARGET_TYPE",
        message: "hide_listing применимо только к жалобе на объявление",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (dto.action === "remove_review" && complaint.targetType !== "review") {
      throw new AppException({
        code: "WRONG_TARGET_TYPE",
        message: "remove_review применимо только к жалобе на отзыв",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.actions.apply({
      moderatorId: admin.id,
      action: dto.action,
      reason: dto.reason,
      complaintId: complaint.id,
      userId: accusedUserId,
      listingId: complaint.targetType === "listing" ? complaint.targetId : null,
      reviewId: complaint.targetType === "review" ? complaint.targetId : null,
      banDurationDays: dto.banDurationDays ?? null,
    });

    const resolved = await this.complaints.setStatus(
      id,
      dto.action === "reject" ? "rejected" : "resolved",
    );
    if (!resolved) throw new NotFoundException("Жалоба не найдена");

    // ТЗ п.12.7/E14 п.14.5 — автор уведомляется о решении, содержание санкции не раскрывается.
    await this.notifications.notify({
      userId: resolved.authorId,
      event: "complaint_decided",
      copy: notificationCopy.complaintDecided(),
    });

    return resolved;
  }

  /** ТЗ п.12.20 — проблемные сделки попадают в очередь независимо от жалоб. */
  @Get("deals/problem")
  async problemDeals() {
    return this.deals.findByStatus("problem");
  }

  /** ТЗ п.12.21-12.22 — разбор проблемной сделки без обязательной жалобы; terminal-статус не меняется. */
  @Post("deals/:dealId/resolve")
  async resolveDeal(
    @Param("dealId") dealId: string,
    @Body() dto: ResolveDealDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    const deal = await this.deals.findById(dealId);
    if (!deal) throw new NotFoundException("Сделка не найдена");
    if (deal.status !== "problem") {
      throw new AppException({
        code: "DEAL_NOT_PROBLEM",
        message: "Разбор доступен только для сделок в статусе problem",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if ((dto.action === "warn" || dto.action === "ban_user") && !dto.userId) {
      throw new AppException({
        code: "USER_ID_REQUIRED",
        message: "Укажите userId — сторону сделки, к которой относится решение",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.actions.apply({
      moderatorId: admin.id,
      action: dto.action,
      reason: dto.reason,
      complaintId: null,
      userId: dto.userId ?? null,
      banDurationDays: dto.banDurationDays ?? null,
    });

    await this.auditLog.create({
      actorId: admin.id,
      action: "moderation.resolve_problem_deal",
      entityType: "deal",
      entityId: dealId,
      reason: dto.reason,
    });

    return { ok: true };
  }

  @Post("users/:id/unban")
  async unban(@Param("id") userId: string, @Body() dto: UnbanDto, @CurrentAdmin() admin: AdminUser) {
    const activeBan = await this.bans.findActiveForUser(userId);
    if (!activeBan) {
      throw new AppException({
        code: "NOT_BANNED",
        message: "Пользователь не заблокирован",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    await this.actions.unban(userId, activeBan.id, admin.id, dto.reason);
    return { ok: true };
  }

  /**
   * ТЗ п.12.9 — доступ модератора к переписке фиксируется в audit_log
   * при каждом обращении, не только при первом.
   */
  @Get("chats/:chatId/messages")
  async readChat(@Param("chatId") chatId: string, @CurrentAdmin() admin: AdminUser) {
    const chat = await this.chats.findChatById(chatId);
    if (!chat) throw new NotFoundException("Чат не найден");

    await this.auditLog.create({
      actorId: admin.id,
      action: "moderation.read_chat",
      entityType: "chat",
      entityId: chatId,
    });

    // Пагинация вглубь истории модератору намеренно не подключена в MVP —
    // последних 50 сообщений достаточно для разбора подавляющего большинства жалоб.
    return this.chats.listMessages(chatId, { limit: 50, cursor: undefined });
  }

  private async requireComplaint(id: string): Promise<Complaint> {
    const complaint = await this.complaints.findById(id);
    if (!complaint) throw new NotFoundException("Жалоба не найдена");
    return complaint;
  }

  private async resolveAccusedUserId(complaint: Complaint): Promise<string | null> {
    switch (complaint.targetType) {
      case "user":
        return complaint.targetId;
      case "listing": {
        const listing = await this.listings.findById(complaint.targetId);
        return listing?.courier.id ?? null;
      }
      case "review": {
        // Жалоба на содержание отзыва обвиняет того, кто его написал, не того, кого оценили.
        const review = await this.reviews.findById(complaint.targetId);
        return review?.author.id ?? null;
      }
      case "message": {
        const message = await this.chats.findMessageById(complaint.targetId);
        return message?.senderId ?? null;
      }
      case "deal": {
        const deal = await this.deals.findById(complaint.targetId);
        if (!deal) return null;
        return deal.customer.id === complaint.authorId ? deal.courier.id : deal.customer.id;
      }
    }
  }

  private async buildContext(complaint: Complaint) {
    const accusedUserId = await this.resolveAccusedUserId(complaint);
    const [author, accused, pastComplaints, decisionsHistory, targetDetail] = await Promise.all([
      this.profiles.findPublicProfile(complaint.authorId),
      accusedUserId ? this.profiles.findPublicProfile(accusedUserId) : Promise.resolve(null),
      accusedUserId ? this.complaints.findPastAgainstUser(accusedUserId) : Promise.resolve([]),
      this.decisions.findByComplaint(complaint.id),
      this.fetchTargetDetail(complaint.targetType, complaint.targetId),
    ]);

    return { complaint, author, accused, pastComplaints, decisions: decisionsHistory, targetDetail };
  }

  private async fetchTargetDetail(targetType: ComplaintTargetType, targetId: string): Promise<unknown> {
    switch (targetType) {
      case "listing":
        return this.listings.findById(targetId);
      case "review":
        return this.reviews.findById(targetId);
      case "message":
        return this.chats.findMessageById(targetId);
      case "deal":
        // Уже несёт опись, фото передачи и историю статусов (ТЗ п.12.8) — Deal собирает их сам (E10).
        return this.deals.findById(targetId);
      case "user":
        return this.profiles.findPublicProfile(targetId);
    }
  }
}
