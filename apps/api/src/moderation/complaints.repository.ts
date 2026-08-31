import type { Executor } from "../database/database.js";
import type { Complaint, ComplaintStatus, ComplaintTargetType, NewComplaint } from "./moderation.types.js";

export interface IComplaintsRepository {
  create(input: NewComplaint, executor?: Executor): Promise<Complaint>;
  findById(id: string, executor?: Executor): Promise<Complaint | null>;
  /** ТЗ п.12.5 — активная (pending/reviewing) жалоба того же автора на ту же цель, если есть. */
  findActive(
    authorId: string,
    targetType: ComplaintTargetType,
    targetId: string,
    executor?: Executor,
  ): Promise<Complaint | null>;
  findByAuthor(authorId: string, executor?: Executor): Promise<Complaint[]>;
  /** Очередь модерации (ТЗ п.12.8) — pending/reviewing, старые сверху. */
  findQueue(executor?: Executor): Promise<Complaint[]>;
  /** Прошлые жалобы НА пользователя (target_type='user') — часть контекста (12.8/12.13). */
  findPastAgainstUser(userId: string, executor?: Executor): Promise<Complaint[]>;
  setStatus(id: string, status: ComplaintStatus, executor?: Executor): Promise<Complaint | null>;
}

export const COMPLAINTS_REPOSITORY = Symbol("COMPLAINTS_REPOSITORY");
