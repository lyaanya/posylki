import { apiGet, apiPost } from "./api";

export interface ModerationQueueItem {
  id: string;
  source: "complaint" | "problem_deal" | "ai_flag";
  category: string | null;
  summary: string;
  createdAt: string;
  detailPath: string;
}

export function fetchModerationQueue(): Promise<ModerationQueueItem[]> {
  return apiGet("/admin/moderation-queue");
}

export interface Complaint {
  id: string;
  authorId: string;
  targetType: "user" | "message" | "listing" | "review" | "deal";
  targetId: string;
  category: string;
  comment: string | null;
  photoUrls: string[];
  status: "pending" | "reviewing" | "resolved" | "rejected";
  createdAt: string;
}

export interface ComplaintDetail {
  complaint: Complaint;
  author: unknown;
  accused: unknown;
  pastComplaints: Complaint[];
  decisions: { action: string; reason: string; createdAt: string }[];
  targetDetail: unknown;
}

export function fetchComplaintDetail(id: string): Promise<ComplaintDetail> {
  return apiGet(`/admin/complaints/${id}`);
}

export type ModerationDecisionAction = "reject" | "warn" | "hide_listing" | "remove_review" | "ban_user";

export function decideComplaint(
  id: string,
  input: { action: ModerationDecisionAction; reason: string; banDurationDays?: number },
): Promise<Complaint> {
  return apiPost(`/admin/complaints/${id}/decide`, input);
}
