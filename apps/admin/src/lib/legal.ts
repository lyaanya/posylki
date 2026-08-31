import { apiGet, apiPost } from "./api";

export type LegalDocumentType = "terms" | "privacy" | "service_rules" | "consent";

export interface LegalDocument {
  id: string;
  type: LegalDocumentType;
  version: number;
  title: string;
  bodyMarkdown: string;
  effectiveAt: string;
  createdAt: string;
}

export interface PublishLegalDocumentInput {
  type: LegalDocumentType;
  title: string;
  bodyMarkdown: string;
  effectiveAt: string;
}

export function fetchLegalDocuments(): Promise<LegalDocument[]> {
  return apiGet("/admin/legal-documents");
}

export function publishLegalDocument(input: PublishLegalDocumentInput): Promise<LegalDocument> {
  return apiPost("/admin/legal-documents", input);
}
