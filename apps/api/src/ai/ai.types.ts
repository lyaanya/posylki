import type { ColumnType, Generated } from "kysely";

export type AiScenario =
  | "listing_moderation"
  | "inventory_moderation"
  | "parse_listing_text"
  | "support_assistant";

/** ai_requests (E13 п. 13.7) — без содержимого запроса/ответа, только метаданные. */
export interface AiRequestsTable {
  id: Generated<string>;
  scenario: AiScenario;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  request_length: number;
  response_length: number | null;
  verdict: string | null;
  duration_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  is_error: boolean;
  error_message: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface NewAiRequestLog {
  scenario: AiScenario;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  requestLength: number;
  responseLength?: number | null;
  verdict?: string | null;
  durationMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  isError: boolean;
  errorMessage?: string | null;
}
