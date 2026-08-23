import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ILegalConsentsRepository } from "./legal-consents.repository.js";
import type { LegalConsent, LegalConsentsTable, NewLegalConsent } from "./auth.types.js";

function toEntity(row: Selectable<LegalConsentsTable>): LegalConsent {
  return {
    id: row.id,
    userId: row.user_id,
    legalDocumentId: row.legal_document_id,
    acceptedAt: new Date(row.accepted_at),
    method: row.method,
  };
}

@Injectable()
export class SupabaseLegalConsentsRepository implements ILegalConsentsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(consent: NewLegalConsent, executor: Executor = this.db): Promise<LegalConsent> {
    const row = await executor
      .insertInto("legal_consents")
      .values({
        user_id: consent.userId,
        legal_document_id: consent.legalDocumentId,
        method: consent.method,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toEntity(row);
  }

  async findByUser(userId: string, executor: Executor = this.db): Promise<LegalConsent[]> {
    const rows = await executor
      .selectFrom("legal_consents")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("accepted_at", "desc")
      .execute();

    return rows.map(toEntity);
  }

  async hasAccepted(
    userId: string,
    legalDocumentId: string,
    executor: Executor = this.db,
  ): Promise<boolean> {
    const row = await executor
      .selectFrom("legal_consents")
      .select("id")
      .where("user_id", "=", userId)
      .where("legal_document_id", "=", legalDocumentId)
      .executeTakeFirst();

    return row !== undefined;
  }
}
