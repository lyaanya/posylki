import type { Executor } from "../database/database.js";
import type { NewAiRequestLog } from "./ai.types.js";

export interface IAiRequestLogRepository {
  create(entry: NewAiRequestLog, executor?: Executor): Promise<void>;
}

export const AI_REQUEST_LOG_REPOSITORY = Symbol("AI_REQUEST_LOG_REPOSITORY");
