import { apiGet } from "./api";

/** Формы совпадают с camelCase-ответом /directories/* (apps/api/src/directories). */
export interface City {
  id: string;
  nameRu: string;
  nameEn: string;
  countryCode: string;
  timezone: string;
  isActive: boolean;
  sortOrder: number;
  synonyms: string[];
}

export interface WeightReference {
  id: string;
  name: string;
  weightGrams: number;
  weightGramsMax: number | null;
  category: string | null;
  sortOrder: number;
}

export interface StopListItem {
  id: string;
  name: string;
  explanation: string | null;
  category: string | null;
  countryCode: string | null;
}

export function searchCities(query: string): Promise<City[]> {
  const q = query.trim();
  return apiGet<City[]>(`/directories/cities${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}

export function fetchWeightReferences(): Promise<WeightReference[]> {
  return apiGet<WeightReference[]>("/directories/weight-references");
}

export function fetchStopList(): Promise<StopListItem[]> {
  return apiGet<StopListItem[]>("/directories/stop-list");
}
