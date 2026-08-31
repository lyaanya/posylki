import { Inject, Injectable } from "@nestjs/common";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "../deals/deals.repository.js";
import { DealsTransitionsService } from "../deals/deals-transitions.service.js";
import { TERMINAL_DEAL_STATUSES } from "../deals/deals.types.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "../listings/listings.repository.js";
import { REVIEWS_REPOSITORY, type IReviewsRepository } from "../reviews/reviews.repository.js";
import { USERS_REPOSITORY, type IUsersRepository } from "../auth/users.repository.js";
import { BANS_REPOSITORY, type IBansRepository } from "./bans.repository.js";
import { WARNINGS_REPOSITORY, type IWarningsRepository } from "./warnings.repository.js";
import {
  MODERATION_DECISIONS_REPOSITORY,
  type IModerationDecisionsRepository,
} from "./moderation-decisions.repository.js";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { ModerationAction } from "./moderation.types.js";

export interface ApplyDecisionInput {
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  complaintId: string | null;
  /** Только для ban_user/warn — кого именно наказываем. */
  userId?: string | null;
  /** Только для hide_listing. */
  listingId?: string | null;
  /** Только для remove_review. */
  reviewId?: string | null;
  /** Только для ban_user — null означает бессрочно (ТЗ п.12.14). */
  banDurationDays?: number | null;
}

/**
 * Побочные эффекты решений модератора (ТЗ E12 пп.12.10, 12.15, 12.18) —
 * общая точка для decide-по-жалобе и resolve-проблемной-сделки-без-жалобы,
 * чтобы каскад блокировки не дублировался в двух контроллерах. Каждое
 * решение пишется и в moderation_decisions (структурированно), и в
 * audit_log (сквозной журнал, 12.11) — это тот же принцип, что и модерация
 * отзывов в E11.
 */
@Injectable()
export class ModerationActionsService {
  constructor(
    @Inject(BANS_REPOSITORY) private readonly bans: IBansRepository,
    @Inject(WARNINGS_REPOSITORY) private readonly warnings: IWarningsRepository,
    @Inject(MODERATION_DECISIONS_REPOSITORY) private readonly decisions: IModerationDecisionsRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
    @Inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(REVIEWS_REPOSITORY) private readonly reviews: IReviewsRepository,
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(DealsTransitionsService) private readonly dealsTransitions: DealsTransitionsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async apply(input: ApplyDecisionInput): Promise<void> {
    switch (input.action) {
      case "reject":
        break;
      case "warn":
        await this.warn(input);
        break;
      case "hide_listing":
        await this.hideListing(input);
        break;
      case "remove_review":
        await this.removeReview(input);
        break;
      case "ban_user":
        await this.banUser(input);
        break;
    }

    await this.decisions.create({
      complaintId: input.complaintId,
      dealId: null,
      moderatorId: input.moderatorId,
      action: input.action,
      reason: input.reason,
    });
    await this.auditLog.create({
      actorId: input.moderatorId,
      action: `moderation.${input.action}`,
      entityType: input.complaintId ? "complaint" : "deal",
      entityId: input.complaintId,
      reason: input.reason,
      after: { userId: input.userId ?? null, listingId: input.listingId ?? null, reviewId: input.reviewId ?? null },
    });
  }

  private async warn(input: ApplyDecisionInput): Promise<void> {
    if (!input.userId) throw new Error("warn требует userId");
    await this.warnings.create({
      userId: input.userId,
      issuedBy: input.moderatorId,
      complaintId: input.complaintId,
      reason: input.reason,
    });
    // ТЗ E14 п.14.5 — предупреждение от модератора, всегда срочно.
    await this.notifications.notify({
      userId: input.userId,
      event: "moderator_warning",
      copy: notificationCopy.moderatorWarning(),
    });
  }

  private async hideListing(input: ApplyDecisionInput): Promise<void> {
    if (!input.listingId) throw new Error("hide_listing требует listingId");
    await this.listings.setStatus(input.listingId, "removed_by_moderator");
  }

  private async removeReview(input: ApplyDecisionInput): Promise<void> {
    if (!input.reviewId) throw new Error("remove_review требует reviewId");
    const before = await this.reviews.findById(input.reviewId);
    if (!before) return;
    await this.reviews.moderateDelete(input.reviewId, input.moderatorId, input.reason);
    // ТЗ E11 п.11.15 — оценка ушла из среднего, пересчёт обязателен.
    await this.reviews.recomputeRating(before.subjectId, before.role);
  }

  /**
   * ТЗ п.12.15/12.18 — полный каскад: денормализованный флаг, снятие
   * объявлений с публикации, перевод активных сделок в problem с
   * уведомлением второй стороны через существующий чат сделки.
   */
  private async banUser(input: ApplyDecisionInput): Promise<void> {
    if (!input.userId) throw new Error("ban_user требует userId");
    const userId = input.userId;

    const bannedUntil =
      input.banDurationDays && input.banDurationDays > 0
        ? new Date(Date.now() + input.banDurationDays * 24 * 60 * 60 * 1000)
        : null;

    await this.bans.create({
      userId,
      bannedBy: input.moderatorId,
      complaintId: input.complaintId,
      reason: input.reason,
      bannedUntil,
    });

    await this.setBlockedFlag(userId, true, input.reason);

    const listings = await this.listings.findByOwner(userId);
    for (const listing of listings) {
      if (listing.status === "published" || listing.status === "hidden_by_author") {
        await this.listings.setStatus(listing.id, "removed_by_moderator");
      }
    }

    const dealsForUser = await this.deals.findForUser(userId);
    for (const deal of dealsForUser) {
      if (!TERMINAL_DEAL_STATUSES.includes(deal.status)) {
        await this.dealsTransitions.markProblem(deal, "Блокировка одной из сторон");
      }
    }
  }

  async unban(userId: string, banId: string, unbannedBy: string, reason: string): Promise<void> {
    await this.bans.unban(banId, unbannedBy, reason);
    await this.setBlockedFlag(userId, false, null);
    await this.auditLog.create({
      actorId: unbannedBy,
      action: "moderation.unban_user",
      entityType: "user",
      entityId: userId,
      reason,
    });
  }

  private async setBlockedFlag(userId: string, isBlocked: boolean, reason: string | null): Promise<void> {
    await this.users.setBlocked(userId, isBlocked, reason);
  }
}
