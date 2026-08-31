import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type {
  IModerationDecisionsRepository,
  NewModerationDecision,
} from "./moderation-decisions.repository.js";
import type { ModerationDecision } from "./moderation.types.js";

interface DecisionRow {
  id: string;
  complaint_id: string | null;
  deal_id: string | null;
  moderator_id: string | null;
  action: ModerationDecision["action"];
  reason: string;
  created_at: Date;
}

function toEntity(row: DecisionRow): ModerationDecision {
  return {
    id: row.id,
    complaintId: row.complaint_id,
    dealId: row.deal_id,
    moderatorId: row.moderator_id,
    action: row.action,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

@Injectable()
export class SupabaseModerationDecisionsRepository implements IModerationDecisionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(input: NewModerationDecision, executor: Executor = this.db): Promise<ModerationDecision> {
    const inserted = await executor
      .insertInto("moderation_decisions")
      .values({
        complaint_id: input.complaintId,
        deal_id: input.dealId,
        moderator_id: input.moderatorId,
        action: input.action,
        reason: input.reason,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toEntity(inserted as DecisionRow);
  }

  async findByComplaint(complaintId: string, executor: Executor = this.db): Promise<ModerationDecision[]> {
    const rows = await executor
      .selectFrom("moderation_decisions")
      .selectAll()
      .where("complaint_id", "=", complaintId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((row) => toEntity(row as DecisionRow));
  }
}
