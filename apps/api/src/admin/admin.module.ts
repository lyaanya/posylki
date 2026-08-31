import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AdminAuthController } from "./admin-auth.controller.js";
import { AdminLegalDocumentsController } from "./admin-legal-documents.controller.js";
import { AdminGuard } from "./admin.guard.js";
import { AdminIdentityGuard } from "./admin-identity.guard.js";
import { AdminRoleGuard } from "./admin-role.guard.js";
import { ADMIN_SESSIONS_REPOSITORY } from "./admin-sessions.repository.js";
import { SupabaseAdminSessionsRepository } from "./admin-sessions.repository.supabase.js";
import { ADMIN_USER_REPOSITORY } from "./admin-user.repository.js";
import { SupabaseAdminUserRepository } from "./admin-user.repository.supabase.js";

@Module({
  imports: [AuditLogModule, AuthModule],
  controllers: [AdminAuthController, AdminLegalDocumentsController],
  providers: [
    AdminGuard,
    AdminIdentityGuard,
    AdminRoleGuard,
    { provide: ADMIN_USER_REPOSITORY, useClass: SupabaseAdminUserRepository },
    { provide: ADMIN_SESSIONS_REPOSITORY, useClass: SupabaseAdminSessionsRepository },
  ],
  exports: [AdminGuard, AdminIdentityGuard, AdminRoleGuard, ADMIN_USER_REPOSITORY, ADMIN_SESSIONS_REPOSITORY],
})
export class AdminModule {}
