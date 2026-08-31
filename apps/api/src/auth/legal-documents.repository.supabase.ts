import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ILegalDocumentsRepository, NewLegalDocument } from "./legal-documents.repository.js";
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

  async createVersion(input: NewLegalDocument, executor: Executor = this.db): Promise<LegalDocument> {
    const latest = await this.findLatestByType(input.type, executor);
    const row = await executor
      .insertInto("legal_documents")
      .values({
        type: input.type,
        version: (latest?.version ?? 0) + 1,
        title: input.title,
        body_markdown: input.bodyMarkdown,
        effective_at: input.effectiveAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toEntity(row);
  }

  async findAll(executor: Executor = this.db): Promise<LegalDocument[]> {
    const rows = await executor.selectFrom("legal_documents").selectAll().orderBy("created_at", "desc").execute();
    return rows.map(toEntity);
  }
}
