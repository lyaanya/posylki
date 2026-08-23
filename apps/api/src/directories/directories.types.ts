import type { ColumnType, Generated } from "kysely";

export interface CitiesTable {
  id: Generated<string>;
  name_ru: string;
  name_en: string;
  country_code: string;
  timezone: string;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  sort_order: number;
  synonyms: string[];
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface CurrenciesTable {
  id: Generated<string>;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface WeightReferencesTable {
  id: Generated<string>;
  name: string;
  weight_grams: number;
  weight_grams_max: number | null;
  category: string | null;
  sort_order: number;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface StopListItemsTable {
  id: Generated<string>;
  name: string;
  explanation: string | null;
  category: string | null;
  country_code: string | null;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface DocumentTypesTable {
  id: Generated<string>;
  name: string;
  country_code: string;
  number_pattern: string | null;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface City {
  id: string;
  nameRu: string;
  nameEn: string;
  countryCode: string;
  timezone: string;
  isActive: boolean;
  sortOrder: number;
  synonyms: string[];
  updatedAt: Date;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
  updatedAt: Date;
}

export interface WeightReference {
  id: string;
  name: string;
  weightGrams: number;
  weightGramsMax: number | null;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: Date;
}

export interface StopListItem {
  id: string;
  name: string;
  explanation: string | null;
  category: string | null;
  countryCode: string | null;
  isActive: boolean;
  updatedAt: Date;
}

export interface DocumentType {
  id: string;
  name: string;
  countryCode: string;
  numberPattern: string | null;
  isActive: boolean;
  updatedAt: Date;
}

// === Ввод для CRUD из админки (E05 п. 5.20) =================================
// Отдельно от New*/Update*, а не Partial<Entity>: сущность несёт id/isActive/
// updatedAt, которыми запись создания и правки не распоряжается напрямую
// (isActive меняется только через setActive, см. репозитории).

export interface NewCity {
  nameRu: string;
  nameEn: string;
  countryCode: string;
  timezone: string;
  sortOrder?: number;
  synonyms?: string[];
}
export type UpdateCity = Partial<NewCity>;

export interface NewCurrency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}
export type UpdateCurrency = Partial<NewCurrency>;

export interface NewWeightReference {
  name: string;
  weightGrams: number;
  weightGramsMax?: number | null;
  category?: string | null;
  sortOrder?: number;
}
export type UpdateWeightReference = Partial<NewWeightReference>;

export interface NewStopListItem {
  name: string;
  explanation?: string | null;
  category?: string | null;
  countryCode?: string | null;
}
export type UpdateStopListItem = Partial<NewStopListItem>;

export interface NewDocumentType {
  name: string;
  countryCode: string;
  numberPattern?: string | null;
}
export type UpdateDocumentType = Partial<NewDocumentType>;
