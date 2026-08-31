import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "./api";

export interface City {
  id: string;
  nameRu: string;
  nameEn: string;
  countryCode: string;
  timezone: string;
  isActive: boolean;
  sortOrder: number;
  synonyms: string[];
  updatedAt: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
  updatedAt: string;
}

export interface WeightReference {
  id: string;
  name: string;
  weightGrams: number;
  weightGramsMax: number | null;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
}

export interface StopListItem {
  id: string;
  name: string;
  explanation: string | null;
  category: string | null;
  countryCode: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface DocumentType {
  id: string;
  name: string;
  countryCode: string;
  numberPattern: string | null;
  isActive: boolean;
  updatedAt: string;
}

/** ТЗ E16 п.16.26 — конфигурация для общей CRUD-таблицы справочников. */
export type DirectoryResource = "cities" | "currencies" | "weight-references" | "stop-list" | "document-types";

export function fetchDirectory<T>(resource: DirectoryResource): Promise<T[]> {
  return apiGet(`/admin/directories/${resource}`);
}

export function createDirectoryItem<T>(resource: DirectoryResource, input: unknown): Promise<T> {
  return apiPost(`/admin/directories/${resource}`, input);
}

export function updateDirectoryItem<T>(resource: DirectoryResource, id: string, input: unknown): Promise<T> {
  return apiPatch(`/admin/directories/${resource}/${id}`, input);
}

export function setDirectoryItemActive<T>(
  resource: DirectoryResource,
  id: string,
  isActive: boolean,
): Promise<T> {
  return apiPatch(`/admin/directories/${resource}/${id}/active`, { isActive });
}

/** Заявки на верификацию хранят только id типа документа — карточка модератора показывает название. */
export function useDocumentTypeNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDirectory<DocumentType>("document-types")
      .then((types) => setNames(Object.fromEntries(types.map((t) => [t.id, t.name]))))
      .catch(() => setNames({}));
  }, []);

  return names;
}
