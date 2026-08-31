import type { Executor } from "../database/database.js";
import type { LegalDocument, LegalDocumentType } from "./auth.types.js";

export interface NewLegalDocument {
  type: LegalDocumentType;
  title: string;
  bodyMarkdown: string;
  effectiveAt: string;
}

export interface ILegalDocumentsRepository {
  /** Последняя (по номеру версии) версия документа данного типа. */
  findLatestByType(type: LegalDocumentType, executor?: Executor): Promise<LegalDocument | null>;
  findById(id: string, executor?: Executor): Promise<LegalDocument | null>;
  /** ТЗ E16 п.16.29 — публикация новой версии; версия вычисляется автоматически (latest+1). Старые версии не редактируются и не удаляются — история. */
  createVersion(input: NewLegalDocument, executor?: Executor): Promise<LegalDocument>;
  /** ТЗ п.16.29 — все документы для админ-панели, новые сверху. */
  findAll(executor?: Executor): Promise<LegalDocument[]>;
}

export const LEGAL_DOCUMENTS_REPOSITORY = Symbol("LEGAL_DOCUMENTS_REPOSITORY");
