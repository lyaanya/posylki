import { apiGet, apiPatch, apiPost } from "./api";

export interface SupportTicket {
  id: string;
  userId: string;
  chatId: string;
  status: "awaiting_moderator" | "in_progress" | "closed";
  linkedObjectType: "deal" | "listing" | "verification" | null;
  linkedObjectId: string | null;
  context: {
    verificationStatus: string;
    totalDealsCount: number;
    activeDealIds: string[];
    activeListingIds: string[];
    platform: string | null;
    appVersion: string | null;
    lastError: string | null;
  };
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  senderId: string | null;
  kind: "text" | "photo" | "system";
  body: string | null;
  createdAt: string;
}

export const SUPPORT_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

export function fetchSupportQueue(): Promise<SupportTicket[]> {
  return apiGet("/admin/support/tickets");
}

export function fetchSupportTicket(id: string): Promise<SupportTicket> {
  return apiGet(`/admin/support/tickets/${id}`);
}

export function fetchSupportMessages(id: string): Promise<SupportMessage[]> {
  return apiGet<{ items: SupportMessage[] }>(`/admin/support/tickets/${id}/messages`).then((p) => [...p.items].reverse());
}

export function sendSupportReply(id: string, body: string): Promise<SupportMessage> {
  return apiPost(`/admin/support/tickets/${id}/messages`, { body });
}

export function claimSupportTicket(id: string): Promise<SupportTicket> {
  return apiPost(`/admin/support/tickets/${id}/claim`);
}

export function closeSupportTicket(id: string): Promise<SupportTicket> {
  return apiPost(`/admin/support/tickets/${id}/close`);
}

export interface SupportFaqEntry {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
}

export function fetchFaq(): Promise<SupportFaqEntry[]> {
  return apiGet("/admin/support/faq");
}

export function createFaq(input: { question: string; answer: string }): Promise<SupportFaqEntry> {
  return apiPost("/admin/support/faq", input);
}

export function updateFaq(id: string, input: { question?: string; answer?: string; isActive?: boolean }): Promise<SupportFaqEntry> {
  return apiPatch(`/admin/support/faq/${id}`, input);
}
