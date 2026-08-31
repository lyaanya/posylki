import type { Executor } from "../database/database.js";
import type { AiScenario, NewAiRequestLog } from "./ai.types.js";

export interface AiUsageSummaryRow {
  scenario: AiScenario;
  requestCount: number;
  errorCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface IAiRequestLogRepository {
  create(entry: NewAiRequestLog, executor?: Executor): Promise<void>;
  /** ТЗ E13 п.13.8 — сводка расходов за период, по сценариям. */
  getUsageSummary(from: Date, to: Date): Promise<AiUsageSummaryRow[]>;
}

export const AI_REQUEST_LOG_REPOSITORY = Symbol("AI_REQUEST_LOG_REPOSITORY");
