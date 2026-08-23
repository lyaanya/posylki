import type { Executor } from "../database/database.js";
import type { NewUserSession, UserSession } from "./auth.types.js";

export interface IUserSessionsRepository {
  create(session: NewUserSession, executor?: Executor): Promise<UserSession>;
  findActiveByUser(userId: string, executor?: Executor): Promise<UserSession[]>;
  findById(id: string, executor?: Executor): Promise<UserSession | null>;
  touch(id: string, executor?: Executor): Promise<void>;
  revoke(id: string, executor?: Executor): Promise<void>;
}

export const USER_SESSIONS_REPOSITORY = Symbol("USER_SESSIONS_REPOSITORY");
