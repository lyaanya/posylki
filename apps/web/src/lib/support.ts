import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

export type SupportTicketStatus = "awaiting_moderator" | "in_progress" | "closed";

export interface SupportTicket {
  id: string;
  status: SupportTicketStatus;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  senderId: string | null;
  kind: "text" | "photo" | "system";
  body: string | null;
  attachmentUrls: string[];
  createdAt: string;
}

export interface SupportFaqEntry {
  id: string;
  question: string;
  answer: string;
}

/** Общий аккаунт "Поддержка" на другой стороне чата (см. apps/api/src/support/support.types.ts). */
export const SUPPORT_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Нужно войти в аккаунт");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(await authHeader()), ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`API ${path} ответил ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface CreateSupportTicketInput {
  linkedObjectType?: "deal" | "listing" | "verification";
  linkedObjectId?: string;
  lastError?: string;
}

export function createOrContinueTicket(input: CreateSupportTicketInput = {}): Promise<SupportTicket> {
  return apiCall<SupportTicket>("/support/tickets", {
    method: "POST",
    body: JSON.stringify({ platform: "web", appVersion: "1.0.0", ...input }),
  });
}

export function fetchMyTicket(): Promise<SupportTicket | null> {
  return apiCall<SupportTicket | null>("/support/tickets/mine");
}

export function fetchTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  // API отдаёт страницу от новых к старым (та же пагинация, что у /chats/:id/messages) —
  // разворачиваем в порядок чтения сверху вниз для простого однострочного экрана поддержки.
  return apiCall<{ items: SupportMessage[] }>(`/support/tickets/${ticketId}/messages?limit=100`).then((page) =>
    [...page.items].reverse(),
  );
}

export function sendTicketMessage(ticketId: string, body: string): Promise<SupportMessage> {
  return apiCall<SupportMessage>(`/support/tickets/${ticketId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function fetchSupportFaq(): Promise<SupportFaqEntry[]> {
  return apiCall<SupportFaqEntry[]>("/support/faq");
}
