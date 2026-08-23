import type { Executor } from "../database/database.js";
import type { DocumentType, NewDocumentType, UpdateDocumentType } from "./directories.types.js";

export interface IDocumentTypesRepository {
  findAllActive(country?: string, executor?: Executor): Promise<DocumentType[]>;
  findById(id: string, executor?: Executor): Promise<DocumentType | null>;
  create(input: NewDocumentType, executor?: Executor): Promise<DocumentType>;
  update(id: string, input: UpdateDocumentType, executor?: Executor): Promise<DocumentType | null>;
  setActive(id: string, isActive: boolean, executor?: Executor): Promise<DocumentType | null>;
}

export const DOCUMENT_TYPES_REPOSITORY = Symbol("DOCUMENT_TYPES_REPOSITORY");
