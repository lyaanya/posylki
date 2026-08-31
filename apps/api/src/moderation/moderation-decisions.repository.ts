import type { Executor } from "../database/database.js";
import type { ModerationAction, ModerationDecision } from "./moderation.types.js";

export interface NewModerationDecision {
  complaintId: string | null;
  dealId: string | null;
  moderatorId: string | null;
  action: ModerationAction;
  reason: string;
}

export interface IModerationDecisionsRepository {
  create(input: NewModerationDecision, executor?: Executor): Promise<ModerationDecision>;
  findByComplaint(complaintId: string, executor?: Executor): Promise<ModerationDecision[]>;
}

export const MODERATION_DECISIONS_REPOSITORY = Symbol("MODERATION_DECISIONS_REPOSITORY");
