import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth.guard.js";
import { VerifiedGuard } from "./verified.guard.js";
import { SupabaseJwtService } from "./supabase-jwt.service.js";
import { USERS_REPOSITORY } from "./users.repository.js";
import { SupabaseUsersRepository } from "./users.repository.supabase.js";
import { LEGAL_DOCUMENTS_REPOSITORY } from "./legal-documents.repository.js";
import { SupabaseLegalDocumentsRepository } from "./legal-documents.repository.supabase.js";
import { LEGAL_CONSENTS_REPOSITORY } from "./legal-consents.repository.js";
import { SupabaseLegalConsentsRepository } from "./legal-consents.repository.supabase.js";
import { USER_SESSIONS_REPOSITORY } from "./user-sessions.repository.js";
import { SupabaseUserSessionsRepository } from "./user-sessions.repository.supabase.js";

@Module({
  providers: [
    SupabaseJwtService,
    VerifiedGuard,
    { provide: USERS_REPOSITORY, useClass: SupabaseUsersRepository },
    { provide: LEGAL_DOCUMENTS_REPOSITORY, useClass: SupabaseLegalDocumentsRepository },
    { provide: LEGAL_CONSENTS_REPOSITORY, useClass: SupabaseLegalConsentsRepository },
    { provide: USER_SESSIONS_REPOSITORY, useClass: SupabaseUserSessionsRepository },
    // Глобальный guard уровня доступа (E03 п. 3.10) — применяется ко всем
    // маршрутам приложения, включая другие модули; см. auth.guard.ts.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [
    VerifiedGuard,
    USERS_REPOSITORY,
    LEGAL_DOCUMENTS_REPOSITORY,
    LEGAL_CONSENTS_REPOSITORY,
    USER_SESSIONS_REPOSITORY,
  ],
})
export class AuthModule {}
