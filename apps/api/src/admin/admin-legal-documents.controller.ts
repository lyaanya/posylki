import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LEGAL_DOCUMENTS_REPOSITORY, type ILegalDocumentsRepository } from "../auth/legal-documents.repository.js";
import type { LegalDocument } from "../auth/auth.types.js";
import { AUDIT_LOG_REPOSITORY, type IAuditLogRepository } from "../audit-log/audit-log.repository.js";
import { AdminGuard } from "./admin.guard.js";
import { AdminRoleGuard } from "./admin-role.guard.js";
import { CurrentAdmin } from "./current-admin.decorator.js";
import type { AdminUser } from "./admin-user.repository.js";
import { PublishLegalDocumentDto } from "./dto/publish-legal-document.dto.js";
import { RequireAdminRole } from "./require-admin-role.decorator.js";

/**
 * ТЗ E16 п.16.29 — управление юридическими документами. Новая версия не
 * заменяет старую (история сохраняется, версии только растут) — она
 * структурно и есть "требование повторного принятия": пока пользователь
 * не примет именно эту версию, ILegalConsentsRepository.hasAccepted для
 * неё вернёт false. Сам гейт, который это проверяет при входе (E03),
 * нигде в приложении ещё не вызывается — см. отчёт эпика 16.
 */
@ApiTags("admin/legal-documents")
@UseGuards(AdminGuard, AdminRoleGuard)
@RequireAdminRole("admin")
@Controller("admin/legal-documents")
export class AdminLegalDocumentsController {
  constructor(
    @Inject(LEGAL_DOCUMENTS_REPOSITORY) private readonly legalDocuments: ILegalDocumentsRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLog: IAuditLogRepository,
  ) {}

  @Get()
  async list(): Promise<LegalDocument[]> {
    return this.legalDocuments.findAll();
  }

  @Post()
  async publish(@Body() dto: PublishLegalDocumentDto, @CurrentAdmin() admin: AdminUser): Promise<LegalDocument> {
    const created = await this.legalDocuments.createVersion(dto);

    await this.auditLog.create({
      actorId: admin.id,
      action: "legal_document.publish",
      entityType: "legal_document",
      entityId: created.id,
      after: { type: created.type, version: created.version },
    });

    return created;
  }
}
