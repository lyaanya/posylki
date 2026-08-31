import { createSupabaseBrowserClient } from "./supabase-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000";

/** Формы совпадают с camelCase-ответом /notifications (apps/api/src/notifications). */
export type NotificationEvent =
  | "chat_message"
  | "deal_created"
  | "deal_status_changed"
  | "deal_overweight_reconfirm"
  | "storage_extension_requested"
  | "storage_extension_decided"
  | "storage_reminder"
  | "review_published"
  | "review_reminder"
  | "complaint_decided"
  | "moderator_warning";

export interface Notification {
  id: string;
  event: NotificationEvent;
  title: string;
  body: string;
  deepLink: string;
  isUrgent: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationSettings {
  messagesPush: boolean;
  messagesEmail: boolean;
  messagesTelegram: boolean;
  listingsPush: boolean;
  listingsEmail: boolean;
  listingsTelegram: boolean;
  servicePush: boolean;
  serviceEmail: boolean;
  serviceTelegram: boolean;
}

export type UpdateNotificationSettings = Partial<NotificationSettings>;

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

export function fetchNotifications(): Promise<Notification[]> {
  return apiCall<Notification[]>("/notifications");
}

export function fetchUnreadNotificationCount(): Promise<number> {
  return apiCall<{ count: number }>("/notifications/unread-count").then((r) => r.count);
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiCall<Notification>(`/notifications/${id}/read`, { method: "POST" });
}

export function fetchNotificationSettings(): Promise<NotificationSettings> {
  return apiCall<NotificationSettings>("/notifications/settings");
}

export function updateNotificationSettings(input: UpdateNotificationSettings): Promise<NotificationSettings> {
  return apiCall<NotificationSettings>("/notifications/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
