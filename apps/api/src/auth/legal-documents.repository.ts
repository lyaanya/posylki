import type { Executor } from "../database/database.js";
import type { LegalDocument, LegalDocumentType } from "./auth.types.js";

export interface ILegalDocumentsRepository {
  /** Последняя (по номеру версии) версия документа данного типа. */
  findLatestByType(type: LegalDocumentType, executor?: Executor): Promise<LegalDocument | null>;
  findById(id: string, executor?: Executor): Promise<LegalDocument | null>;
}

export const LEGAL_DOCUMENTS_REPOSITORY = Symbol("LEGAL_DOCUMENTS_REPOSITORY");
