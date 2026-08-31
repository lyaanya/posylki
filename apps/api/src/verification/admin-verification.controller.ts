import { Controller, Get, HttpStatus, Inject, NotFoundException, Param, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../admin/admin.guard.js";
import { CurrentAdmin } from "../admin/current-admin.decorator.js";
import type { AdminUser } from "../admin/admin-user.repository.js";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";
import { AppException } from "../common/app-exception.js";
import { USERS_REPOSITORY, type IUsersRepository } from "../auth/users.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DecideVerificationDto } from "./dto/decide-verification.dto.js";
import {
  VERIFICATION_PHOTO_STORAGE,
  type IVerificationPhotoStorage,
} from "./verification-photo-storage.js";
import {
  VERIFICATION_REQUESTS_REPOSITORY,
  type IVerificationRequestsRepository,
} from "./verification-requests.repository.js";
import type { VerificationRequest } from "./verification.types.js";

interface QueueItem extends VerificationRequest {
  /** ТЗ п.16.6/16.11 — сколько сейчас ждёт заявка, в минутах. */
  waitingMinutes: number;
}

/**
 * ТЗ E16 пп.16.5-16.11 — очередь верификации, первая и самая важная часть
 * админ-панели: без неё E04 реализован, но не работает (см. эпик).
 */
@ApiTags("admin/verification")
@UseGuards(AdminGuard)
@Controller("admin/verification")
export class AdminVerificationController {
  constructor(
    @Inject(VERIFICATION_REQUESTS_REPOSITORY) private readonly requests: IVerificationRequestsRepository,
    @Inject(VERIFICATION_PHOTO_STORAGE) private readonly photoStorage: IVerificationPhotoStorage,
    @Inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /** ТЗ п.16.6/16.11 — от старых к новым, со временем ожидания и агрегированным средним. */
  @Get("queue")
  async queue(): Promise<{ items: QueueItem[]; averageWaitingMinutes: number }> {
    const pending = await this.requests.findQueue();
    const now = Date.now();
    const items = pending.map((request) => ({
      ...request,
      waitingMinutes: Math.round((now - request.createdAt.getTime()) / 60_000),
    }));
    const averageWaitingMinutes =
      items.length > 0 ? Math.round(items.reduce((sum, i) => sum + i.waitingMinutes, 0) / items.length) : 0;
    return { items, averageWaitingMinutes };
  }

  /** ТЗ п.16.7 — карточка заявки: временные ссылки на фото и история прошлых заявок этого пользователя. */
  @Get(":id")
  async detail(@Param("id") id: string) {
    const request = await this.requireRequest(id);
    const [documentPhotoUrl, selfiePhotoUrl, history] = await Promise.all([
      request.documentPhotoPath ? this.photoStorage.createSignedUrl(request.documentPhotoPath) : null,
      request.selfiePhotoPath ? this.photoStorage.createSignedUrl(request.selfiePhotoPath) : null,
      this.requests.findAllForUser(request.userId),
    ]);
    return {
      request,
      documentPhotoUrl,
      selfiePhotoUrl,
      pastRequests: history.filter((r) => r.id !== request.id),
    };
  }

  /** ТЗ п.16.9/16.10 — решение и немедленное необратимое удаление фото независимо от исхода. */
  @Post(":id/decide")
  async decide(
    @Param("id") id: string,
    @Body() dto: DecideVerificationDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<VerificationRequest> {
    const request = await this.requireRequest(id);
    if (request.status !== "pending") {
      throw new AppException({
        code: "VERIFICATION_ALREADY_DECIDED",
        message: "По этой заявке уже принято решение",
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (!dto.approved && !dto.rejectionReasonCode) {
      throw new AppException({
        code: "REJECTION_REASON_REQUIRED",
        message: "Для отклонения нужно указать причину",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // ТЗ п.16.10/E04.15 — файлы удаляются немедленно и безвозвратно, решение не блокируется их отсутствием.
    await Promise.all([
      request.documentPhotoPath ? this.photoStorage.delete(request.documentPhotoPath) : null,
      request.selfiePhotoPath ? this.photoStorage.delete(request.selfiePhotoPath) : null,
    ]);

    const decided = await this.requests.decide(id, {
      approved: dto.approved,
      rejectionReasonCode: dto.rejectionReasonCode ?? null,
      rejectionComment: dto.rejectionComment ?? null,
      adminId: admin.id,
    });
    if (!decided) throw new NotFoundException("Заявка не найдена");

    if (dto.approved) {
      await this.users.approveVerification(request.userId, {
        firstName: request.submittedFirstName,
        lastName: request.submittedLastName,
        dateOfBirth: request.submittedDateOfBirth,
        documentType: request.documentType,
        documentNumberHash: request.documentNumberHash,
        adminId: admin.id,
      });
    } else {
      await this.users.rejectVerification(request.userId);
    }

    await this.auditLog.create({
      actorId: admin.id,
      action: dto.approved ? "verification.approve" : "verification.reject",
      entityType: "verification_request",
      entityId: request.id,
      reason: dto.rejectionComment ?? null,
      after: { approved: dto.approved, rejectionReasonCode: dto.rejectionReasonCode ?? null },
    });

    await this.notifications.notify({
      userId: request.userId,
      event: "verification_result",
      copy: notificationCopy.verificationResult(dto.approved),
    });

    return decided;
  }

  private async requireRequest(id: string): Promise<VerificationRequest> {
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException("Заявка не найдена");
    return request;
  }
}
