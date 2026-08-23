import type { Executor } from "../database/database.js";
import type { LegalConsent, NewLegalConsent } from "./auth.types.js";

export interface ILegalConsentsRepository {
  create(consent: NewLegalConsent, executor?: Executor): Promise<LegalConsent>;
  findByUser(userId: string, executor?: Executor): Promise<LegalConsent[]>;
  /** Принял ли пользователь конкретную версию документа (для гейта 3.15). */
  hasAccepted(userId: string, legalDocumentId: string, executor?: Executor): Promise<boolean>;
}

export const LEGAL_CONSENTS_REPOSITORY = Symbol("LEGAL_CONSENTS_REPOSITORY");
