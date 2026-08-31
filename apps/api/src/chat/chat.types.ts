import type { ColumnType, Generated } from "kysely";

export type MessageKind = "text" | "photo" | "system";

export type ChatKind = "user" | "support";

export interface ChatsTable {
  id: Generated<string>;
  /** null только у чатов поддержки (E15) — у обычного чата объявление обязательно. */
  listing_id: string | null;
  owner_id: string;
  other_user_id: string;
  kind: Generated<ChatKind>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface MessagesTable {
  id: Generated<string>;
  chat_id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface MessageAttachmentsTable {
  id: Generated<string>;
  message_id: string;
  storage_path: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface ChatReadStateTable {
  chat_id: string;
  user_id: string;
  last_read_at: ColumnType<Date, string | undefined, string>;
}

export interface UserBlocksTable {
  blocker_id: string;
  blocked_id: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

// === Доменные типы (camelCase, то, что видит контроллер и клиент) =========

export interface ChatParticipant {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  verified: boolean;
  /** До E11 (отзывы) всегда 0. */
  rating: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string | null;
  kind: MessageKind;
  body: string | null;
  attachmentUrls: string[];
  createdAt: Date;
}

export interface ChatSummary {
  id: string;
  listingId: string;
  /** С точки зрения текущего пользователя — собеседник, не обязательно owner. */
  counterpart: ChatParticipant;
  lastMessage: Message | null;
  unreadCount: number;
  isBlockedByMe: boolean;
  updatedAt: Date;
}

export interface NewMessage {
  chatId: string;
  /** null только для системных сообщений (kind='system'). */
  senderId: string | null;
  kind: MessageKind;
  body: string | null;
  attachmentStoragePaths: string[];
}
