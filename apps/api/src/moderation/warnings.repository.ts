import type { Executor } from "../database/database.js";
import type { UserWarning } from "./moderation.types.js";

export interface NewUserWarning {
  userId: string;
  issuedBy: string | null;
  complaintId: string | null;
  reason: string;
}

export interface IWarningsRepository {
  create(input: NewUserWarning, executor?: Executor): Promise<UserWarning>;
  /** ТЗ п.12.12 — самое старое непрочитанное предупреждение, показывается при входе. */
  findOldestUnacknowledged(userId: string, executor?: Executor): Promise<UserWarning | null>;
  findByUser(userId: string, executor?: Executor): Promise<UserWarning[]>;
  acknowledge(id: string, userId: string, executor?: Executor): Promise<UserWarning | null>;
}

export const WARNINGS_REPOSITORY = Symbol("WARNINGS_REPOSITORY");
