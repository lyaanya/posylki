import { Controller, Inject, NotFoundException, Param, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../admin/admin.guard.js";
import { CurrentAdmin } from "../admin/current-admin.decorator.js";
import type { AdminUser } from "../admin/admin-user.repository.js";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";
import { ModerateReviewDto } from "./dto/moderate-review.dto.js";
import { REVIEWS_REPOSITORY, type IReviewsRepository } from "./reviews.repository.js";
import type { Review } from "./reviews.types.js";

/**
 * ТЗ п.11.14-11.17 — модератор удаляет отзыв только за оскорбление,
 * нецензурную лексику или раскрытие персональных данных, никогда по
 * просьбе того, кому отзыв не понравился (это не проверяется кодом —
 * это redактор из ТЗ и обязанность модератора; причина обязательна и
 * попадает в audit_log для разбора спорных случаев).
 */
@ApiTags("admin/reviews")
@UseGuards(AdminGuard)
@Controller("admin/reviews")
export class AdminReviewsController {
  constructor(
    @Inject(REVIEWS_REPOSITORY) private readonly reviews: IReviewsRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
  ) {}

  @Post(":id/remove")
  async remove(
    @Param("id") id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<Review> {
    const before = await this.reviews.findById(id);
    if (!before) throw new NotFoundException("Отзыв не найден");

    const after = await this.reviews.moderateDelete(id, admin.id, dto.reason);
    if (!after) throw new NotFoundException("Отзыв не найден");

    // Оценка исчезла из среднего — пересчёт обязателен (11.15).
    await this.reviews.recomputeRating(before.subjectId, before.role);

    await this.auditLog.create({
      actorId: admin.id,
      action: "review.remove",
      entityType: "review",
      entityId: id,
      before,
      after,
      reason: dto.reason,
    });

    return after;
  }
}
