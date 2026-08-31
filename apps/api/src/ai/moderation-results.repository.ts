import type { Executor } from "../database/database.js";
import type { ModerationResult, NewModerationResult } from "./ai.types.js";

export interface IModerationResultsRepository {
  create(entry: NewModerationResult, executor?: Executor): Promise<ModerationResult>;
  /** Очередь ручного просмотра (13.14/13.20) — непросмотренные, старые сначала. */
  findPending(): Promise<ModerationResult[]>;
}

export const MODERATION_RESULTS_REPOSITORY = Symbol("MODERATION_RESULTS_REPOSITORY");
