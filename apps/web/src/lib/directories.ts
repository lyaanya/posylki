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

/**
 * CityPicker хранит только отображаемое имя города (E05), а не его id —
 * этот id нужен только в момент отправки формы (создание объявления),
 * поэтому находим его по имени здесь, а не храним заранее.
 */
export async function resolveCityId(nameRu: string): Promise<string | null> {
  const trimmed = nameRu.trim();
  if (!trimmed) {
    return null;
  }
  const results = await searchCities(trimmed);
  const exact = results.find((city) => city.nameRu === trimmed);
  return (exact ?? results[0])?.id ?? null;
}

export function fetchWeightReferences(): Promise<WeightReference[]> {
  return apiGet<WeightReference[]>("/directories/weight-references");
}

export function fetchStopList(): Promise<StopListItem[]> {
  return apiGet<StopListItem[]>("/directories/stop-list");
}
