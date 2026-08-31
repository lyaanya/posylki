import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";
import { USERS_REPOSITORY, type IUsersRepository } from "../auth/users.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import {
  VERIFICATION_PHOTO_STORAGE,
  type IVerificationPhotoStorage,
} from "./verification-photo-storage.js";
import {
  VERIFICATION_REQUESTS_REPOSITORY,
  type IVerificationRequestsRepository,
} from "./verification-requests.repository.js";

const REVIEW_TIMEOUT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ТЗ E04 п.4.16 — заявка, которая провисела в очереди дольше 30 суток,
 * закрывается автоматически: фото удаляются, статус — rejected с причиной
 * review_timeout. Тот же путь, что и у решения модератора (удаление до
 * записи решения, одна транзакция на уровне repository.decide()).
 */
@Injectable()
export class VerificationExpiryCronService {
  private readonly logger = new Logger(VerificationExpiryCronService.name);

  constructor(
    @Inject(VERIFICATION_REQUESTS_REPOSITORY) private readonly requests: IVerificationRequestsRepository,
    @Inject(VERIFICATION_PHOTO_STORAGE) private readonly photoStorage: IVerificationPhotoStorage,
    @Inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const cutoff = new Date(Date.now() - REVIEW_TIMEOUT_DAYS * DAY_MS);
    const pending = await this.requests.findQueue();
    const stale = pending.filter((request) => request.createdAt < cutoff);

    for (const request of stale) {
      await Promise.all([
        request.documentPhotoPath ? this.photoStorage.delete(request.documentPhotoPath) : null,
        request.selfiePhotoPath ? this.photoStorage.delete(request.selfiePhotoPath) : null,
      ]);

      await this.requests.decide(request.id, {
        approved: false,
        rejectionReasonCode: "review_timeout",
        rejectionComment: null,
        adminId: null,
      });
      await this.users.rejectVerification(request.userId);

      await this.auditLog.create({
        actorId: request.userId,
        action: "verification.auto_reject_timeout",
        entityType: "verification_request",
        entityId: request.id,
        reason: `Истёк срок рассмотрения (${REVIEW_TIMEOUT_DAYS} суток)`,
      });

      await this.notifications.notify({
        userId: request.userId,
        event: "verification_result",
        copy: notificationCopy.verificationResult(false),
      });
    }

    if (stale.length > 0) {
      this.logger.log(`Верификация: автоматически закрыто заявок по таймауту — ${stale.length}`);
    }
  }
}
