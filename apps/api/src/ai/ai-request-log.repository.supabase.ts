import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { AiUsageSummaryRow, IAiRequestLogRepository } from "./ai-request-log.repository.js";
import type { AiScenario, NewAiRequestLog } from "./ai.types.js";

@Injectable()
export class SupabaseAiRequestLogRepository implements IAiRequestLogRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(entry: NewAiRequestLog, executor: Executor = this.db): Promise<void> {
    await executor
      .insertInto("ai_requests")
      .values({
        scenario: entry.scenario,
        entity_type: entry.entityType ?? null,
        entity_id: entry.entityId ?? null,
        actor_id: entry.actorId ?? null,
        request_length: entry.requestLength,
        response_length: entry.responseLength ?? null,
        verdict: entry.verdict ?? null,
        duration_ms: entry.durationMs,
        input_tokens: entry.inputTokens ?? null,
        output_tokens: entry.outputTokens ?? null,
        is_error: entry.isError,
        error_message: entry.errorMessage ?? null,
      })
      .execute();
  }

  async getUsageSummary(from: Date, to: Date): Promise<AiUsageSummaryRow[]> {
    const rows = await this.db
      .selectFrom("ai_requests")
      .select((eb) => [
        "scenario",
        eb.fn.countAll<number>().as("request_count"),
        eb.fn.sum<number>(sql`case when is_error then 1 else 0 end`).as("error_count"),
        eb.fn.sum<number>("input_tokens").as("input_tokens"),
        eb.fn.sum<number>("output_tokens").as("output_tokens"),
      ])
      .where("created_at", ">=", from)
      .where("created_at", "<", to)
      .groupBy("scenario")
      .execute();

    return rows.map((row) => ({
      scenario: row.scenario as AiScenario,
      requestCount: Number(row.request_count),
      errorCount: Number(row.error_count ?? 0),
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
    }));
  }
}
