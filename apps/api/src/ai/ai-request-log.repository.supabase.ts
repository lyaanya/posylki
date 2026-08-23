import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IAiRequestLogRepository } from "./ai-request-log.repository.js";
import type { NewAiRequestLog } from "./ai.types.js";

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
}
