import type { Executor } from "../database/database.js";
import type { UserBan } from "./moderation.types.js";

export interface NewUserBan {
  userId: string;
  bannedBy: string | null;
  complaintId: string | null;
  reason: string;
  bannedUntil: Date | null;
}

export interface IBansRepository {
  create(input: NewUserBan, executor?: Executor): Promise<UserBan>;
  findActiveForUser(userId: string, executor?: Executor): Promise<UserBan | null>;
  findByUser(userId: string, executor?: Executor): Promise<UserBan[]>;
  /** ТЗ п.12.19 — снятие блокировки с обязательной причиной. unbannedBy=null — автоматическое снятие по сроку (12.14). */
  unban(id: string, unbannedBy: string | null, reason: string, executor?: Executor): Promise<UserBan | null>;
  /** Просроченные временные блокировки — для автоматического снятия (12.14). */
  findExpiredActive(asOf: Date, executor?: Executor): Promise<UserBan[]>;
}

export const BANS_REPOSITORY = Symbol("BANS_REPOSITORY");
