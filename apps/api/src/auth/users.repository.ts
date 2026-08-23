import type { Executor } from "../database/database.js";
import type { VerificationStatus } from "./auth.types.js";

export interface AuthUser {
  id: string;
  email: string;
  verificationStatus: VerificationStatus;
  isBlocked: boolean;
  deletedAt: Date | null;
}

export interface IUsersRepository {
  findById(id: string, executor?: Executor): Promise<AuthUser | null>;
}

export const USERS_REPOSITORY = Symbol("USERS_REPOSITORY");
