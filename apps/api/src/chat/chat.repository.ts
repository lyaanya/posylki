import type { PaginatedResponse } from "../common/pagination.js";
import type { Executor } from "../database/database.js";
import type { ChatSummary, Message, NewMessage } from "./chat.types.js";

export interface ChatRef {
  id: string;
  listingId: string | null;
  ownerId: string;
  otherUserId: string;
}

export interface IChatRepository {
  /** ТЗ п.9.1, 9.4 — чат уникален по (объявление, второй участник), создаётся при первом сообщении. */
  findOrCreateChatByListing(
    listingId: string,
    listingOwnerId: string,
    otherUserId: string,
    executor?: Executor,
  ): Promise<ChatRef>;
  findChatById(chatId: string, executor?: Executor): Promise<ChatRef | null>;
  /** ТЗ E15 п.15.3 — чат обращения в поддержку с фиксированным аккаунтом "Поддержка" на другой стороне. */
  findOrCreateSupportChat(userId: string, supportAccountId: string, executor?: Executor): Promise<ChatRef>;
  /** ТЗ E12 п.12.1 — жалоба на конкретное сообщение: нужно найти его чат и автора. */
  findMessageById(messageId: string, executor?: Executor): Promise<Message | null>;
  listChatsForUser(userId: string, executor?: Executor): Promise<ChatSummary[]>;
  listMessages(
    chatId: string,
    options: { limit: number; cursor?: { sortValue: string; id: string } | undefined },
    executor?: Executor,
  ): Promise<PaginatedResponse<Message>>;
  createMessage(input: NewMessage, executor?: Executor): Promise<Message>;
  /** Системные сообщения по событиям сделки/модерации (E10 deals-transitions.service.ts, E12). */
  createSystemMessage(chatId: string, body: string, executor?: Executor): Promise<Message>;
  markRead(chatId: string, userId: string, executor?: Executor): Promise<void>;
  /** E14 п.14.16 — приближение "чат открыт": недавняя отметка прочтения означает активный экран. */
  getLastReadAt(chatId: string, userId: string): Promise<Date | null>;
  totalUnreadForUser(userId: string, executor?: Executor): Promise<number>;
  isBlocked(blockerId: string, blockedId: string, executor?: Executor): Promise<boolean>;
  blockUser(blockerId: string, blockedId: string, executor?: Executor): Promise<void>;
  unblockUser(blockerId: string, blockedId: string, executor?: Executor): Promise<void>;
}

export const CHAT_REPOSITORY = Symbol("CHAT_REPOSITORY");
