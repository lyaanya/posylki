import type { Executor } from "../database/database.js";
import type { DecideVerificationInput, NewVerificationRequest, VerificationRequest } from "./verification.types.js";

export interface IVerificationRequestsRepository {
  create(entry: NewVerificationRequest, executor?: Executor): Promise<VerificationRequest>;
  findActiveForUser(userId: string): Promise<VerificationRequest | null>;
  findLatestForUser(userId: string): Promise<VerificationRequest | null>;
  /** ТЗ п.16.7 — история прошлых заявок этого пользователя, включая нынешнюю. */
  findAllForUser(userId: string): Promise<VerificationRequest[]>;
  findById(id: string): Promise<VerificationRequest | null>;
  /** ТЗ п.16.6 — от старых к новым. */
  findQueue(): Promise<VerificationRequest[]>;
  decide(id: string, input: DecideVerificationInput): Promise<VerificationRequest | null>;
}

export const VERIFICATION_REQUESTS_REPOSITORY = Symbol("VERIFICATION_REQUESTS_REPOSITORY");
