import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { AuditLogModule } from "../audit-log/audit-log.module.js";
import { AdminDirectoriesController } from "./admin-directories.controller.js";
import { DirectoriesController } from "./directories.controller.js";
import { CITIES_REPOSITORY } from "./cities.repository.js";
import { SupabaseCitiesRepository } from "./cities.repository.supabase.js";
import { CURRENCIES_REPOSITORY } from "./currencies.repository.js";
import { SupabaseCurrenciesRepository } from "./currencies.repository.supabase.js";
import { WEIGHT_REFERENCES_REPOSITORY } from "./weight-references.repository.js";
import { SupabaseWeightReferencesRepository } from "./weight-references.repository.supabase.js";
import { STOP_LIST_ITEMS_REPOSITORY } from "./stop-list-items.repository.js";
import { SupabaseStopListItemsRepository } from "./stop-list-items.repository.supabase.js";
import { DOCUMENT_TYPES_REPOSITORY } from "./document-types.repository.js";
import { SupabaseDocumentTypesRepository } from "./document-types.repository.supabase.js";

@Module({
  imports: [AdminModule, AuditLogModule],
  controllers: [DirectoriesController, AdminDirectoriesController],
  providers: [
    { provide: CITIES_REPOSITORY, useClass: SupabaseCitiesRepository },
    { provide: CURRENCIES_REPOSITORY, useClass: SupabaseCurrenciesRepository },
    { provide: WEIGHT_REFERENCES_REPOSITORY, useClass: SupabaseWeightReferencesRepository },
    { provide: STOP_LIST_ITEMS_REPOSITORY, useClass: SupabaseStopListItemsRepository },
    { provide: DOCUMENT_TYPES_REPOSITORY, useClass: SupabaseDocumentTypesRepository },
  ],
  exports: [
    CITIES_REPOSITORY,
    CURRENCIES_REPOSITORY,
    WEIGHT_REFERENCES_REPOSITORY,
    STOP_LIST_ITEMS_REPOSITORY,
    DOCUMENT_TYPES_REPOSITORY,
  ],
})
export class DirectoriesModule {}
