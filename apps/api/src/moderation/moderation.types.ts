import type { ColumnType, Generated } from "kysely";

export type ComplaintTargetType = "user" | "message" | "listing" | "review" | "deal";
export type ComplaintCategory =
  | "fraud"
  | "prohibited_item"
  | "rudeness"
  | "breach_of_agreement"
  | "fake_documents"
  | "spam"
  | "other";
export type ComplaintStatus = "pending" | "reviewing" | "resolved" | "rejected";
export type ModerationAction = "reject" | "warn" | "hide_listing" | "remove_review" | "ban_user";

export interface ComplaintsTable {
  id: Generated<string>;
  author_id: string;
  target_type: ComplaintTargetType;
  target_id: string;
  category: ComplaintCategory;
  comment: string | null;
  photo_paths: string[];
  status: Generated<ComplaintStatus>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface ModerationDecisionsTable {
  id: Generated<string>;
  complaint_id: string | null;
  deal_id: string | null;
  moderator_id: string | null;
  action: ModerationAction;
  reason: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface UserWarningsTable {
  id: Generated<string>;
  user_id: string;
  issued_by: string | null;
  complaint_id: string | null;
  reason: string;
  created_at: ColumnType<Date, string | undefined, never>;
  acknowledged_at: ColumnType<Date | null, string | null, string | null>;
}

export interface UserBansTable {
  id: Generated<string>;
  user_id: string;
  banned_by: string | null;
  complaint_id: string | null;
  reason: string;
  banned_until: ColumnType<Date | null, string | null, never>;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  unbanned_at: ColumnType<Date | null, string | null, string | null>;
  unbanned_by: string | null;
  unban_reason: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

// === Доменные типы ===========================================================

export interface Complaint {
  id: string;
  authorId: string;
  targetType: ComplaintTargetType;
  targetId: string;
  category: ComplaintCategory;
  comment: string | null;
  photoUrls: string[];
  status: ComplaintStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewComplaint {
  authorId: string;
  targetType: ComplaintTargetType;
  targetId: string;
  category: ComplaintCategory;
  comment: string | null;
  photoPaths: string[];
}

export interface ModerationDecision {
  id: string;
  complaintId: string | null;
  dealId: string | null;
  moderatorId: string | null;
  action: ModerationAction;
  reason: string;
  createdAt: Date;
}

export interface UserWarning {
  id: string;
  userId: string;
  reason: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
}

export interface UserBan {
  id: string;
  userId: string;
  reason: string;
  bannedUntil: Date | null;
  isActive: boolean;
  createdAt: Date;
}
