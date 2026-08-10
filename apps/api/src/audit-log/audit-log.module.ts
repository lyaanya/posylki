import { Module } from "@nestjs/common";
import { AUDIT_LOG_REPOSITORY } from "./audit-log.repository.js";
import { SupabaseAuditLogRepository } from "./audit-log.repository.supabase.js";

@Module({
  providers: [
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: SupabaseAuditLogRepository,
    },
  ],
  exports: [AUDIT_LOG_REPOSITORY],
})
export class AuditLogModule {}
