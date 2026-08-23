import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ILegalDocumentsRepository } from "./legal-documents.repository.js";
import type { LegalDocument, LegalDocumentsTable } from "./auth.types.js";

function toEntity(row: Selectable<LegalDocumentsTable>): LegalDocument {
  return {
    id: row.id,
    type: row.type,
    version: row.version,
    title: row.title,
    bodyMarkdown: row.body_markdown,
    effectiveAt: new Date(row.effective_at),
    createdAt: new Date(row.created_at),
  };
}

@Injectable()
export class SupabaseLegalDocumentsRepository implements ILegalDocumentsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findLatestByType(
    type: LegalDocument["type"],
    executor: Executor = this.db,
  ): Promise<LegalDocument | null> {
    const row = await executor
      .selectFrom("legal_documents")
      .selectAll()
      .where("type", "=", type)
      .orderBy("version", "desc")
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async findById(id: string, executor: Executor = this.db): Promise<LegalDocument | null> {
    const row = await executor
      .selectFrom("legal_documents")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }
}
