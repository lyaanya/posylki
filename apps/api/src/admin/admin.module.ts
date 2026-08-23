import { Module } from "@nestjs/common";
import { AdminGuard } from "./admin.guard.js";
import { ADMIN_USER_REPOSITORY } from "./admin-user.repository.js";
import { SupabaseAdminUserRepository } from "./admin-user.repository.supabase.js";

@Module({
  providers: [AdminGuard, { provide: ADMIN_USER_REPOSITORY, useClass: SupabaseAdminUserRepository }],
  exports: [AdminGuard, ADMIN_USER_REPOSITORY],
})
export class AdminModule {}
