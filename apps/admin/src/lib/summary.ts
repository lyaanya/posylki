import { apiGet } from "./api";

export interface AiUsageRow {
  scenario: string;
  requestCount: number;
  errorCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AdminSummary {
  verificationQueueCount: number;
  averageVerificationWaitingMinutes: number;
  moderationQueueCount: number;
  openSupportTicketsCount: number;
  problemDealsCount: number;
  aiUsage: AiUsageRow[];
}

export function fetchSummary(): Promise<AdminSummary> {
  return apiGet("/admin/summary");
}
