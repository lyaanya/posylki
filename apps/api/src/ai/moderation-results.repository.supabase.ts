import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IModerationResultsRepository } from "./moderation-results.repository.js";
import type { ModerationResult, NewModerationResult } from "./ai.types.js";

function toDomain(row: {
  id: string;
  scenario: "listing_moderation" | "inventory_moderation";
  entity_type: string;
  entity_id: string;
  verdict: "flag" | "reject";
  category: string | null;
  explanation: string | null;
  contacts_found: string[];
  reviewed_at: Date | null;
  reviewed_by: string | null;
  created_at: Date;
}): ModerationResult {
  return {
    id: row.id,
    scenario: row.scenario,
    entityType: row.entity_type,
    entityId: row.entity_id,
    verdict: row.verdict,
    category: row.category,
    explanation: row.explanation,
    contactsFound: row.contacts_found,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
  };
}

@Injectable()
export class SupabaseModerationResultsRepository implements IModerationResultsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(entry: NewModerationResult, executor: Executor = this.db): Promise<ModerationResult> {
    const row = await executor
      .insertInto("moderation_results")
      .values({
        scenario: entry.scenario,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        verdict: entry.verdict,
        category: entry.category,
        explanation: entry.explanation,
        contacts_found: entry.contactsFound,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findPending(): Promise<ModerationResult[]> {
    const rows = await this.db
      .selectFrom("moderation_results")
      .selectAll()
      .where("reviewed_at", "is", null)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map(toDomain);
  }
}
