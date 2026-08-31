import type { Executor } from "../database/database.js";
import type { NewSupportTicket, SupportTicket, SupportTicketStatus } from "./support.types.js";

export interface ISupportTicketsRepository {
  create(entry: NewSupportTicket, executor?: Executor): Promise<SupportTicket>;
  /** ТЗ п.15.3 — активное (не закрытое) обращение пользователя, если есть. */
  findActiveForUser(userId: string): Promise<SupportTicket | null>;
  /** ТЗ п.15.19 — последнее обращение пользователя вообще, включая закрытые (для переоткрытия). */
  findLatestForUser(userId: string): Promise<SupportTicket | null>;
  findById(id: string): Promise<SupportTicket | null>;
  findByChatId(chatId: string): Promise<SupportTicket | null>;
  /** ТЗ п.15.15 — очередь модератора: всё не закрытое. */
  findQueue(): Promise<SupportTicket[]>;
  setStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket | null>;
  /**
   * ТЗ п.15.19 — переоткрытие: тот же тикет, новый цикл жизни. `update`
   * заменяет привязку к объекту и контекст на актуальные, если передан
   * (открытие через "написать в поддержку" с новым контекстом); без него —
   * просто снятие статуса closed (продолжение перепиской).
   */
  reopen(
    id: string,
    update?: { linkedObjectType: NewSupportTicket["linkedObjectType"]; linkedObjectId: string | null; context: NewSupportTicket["context"] },
  ): Promise<SupportTicket | null>;
  claim(id: string, adminId: string): Promise<SupportTicket | null>;
}

export const SUPPORT_TICKETS_REPOSITORY = Symbol("SUPPORT_TICKETS_REPOSITORY");
