import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { AuditLogModule } from "../audit-log/audit-log.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DirectoriesModule } from "../directories/directories.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AdminVerificationController } from "./admin-verification.controller.js";
import { VERIFICATION_PHOTO_STORAGE } from "./verification-photo-storage.js";
import { SupabaseVerificationPhotoStorage } from "./verification-photo-storage.supabase.js";
import { VERIFICATION_REQUESTS_REPOSITORY } from "./verification-requests.repository.js";
import { SupabaseVerificationRequestsRepository } from "./verification-requests.repository.supabase.js";
import { VerificationController } from "./verification.controller.js";

@Module({
  imports: [AuthModule, DirectoriesModule, AdminModule, AuditLogModule, NotificationsModule],
  controllers: [VerificationController, AdminVerificationController],
  providers: [
    { provide: VERIFICATION_REQUESTS_REPOSITORY, useClass: SupabaseVerificationRequestsRepository },
    { provide: VERIFICATION_PHOTO_STORAGE, useClass: SupabaseVerificationPhotoStorage },
  ],
  exports: [VERIFICATION_REQUESTS_REPOSITORY],
})
export class VerificationModule {}
