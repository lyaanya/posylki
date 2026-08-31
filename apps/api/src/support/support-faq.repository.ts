import type { NewSupportFaqEntry, SupportFaqEntry, UpdateSupportFaqEntry } from "./support.types.js";

export interface ISupportFaqRepository {
  findAllActive(): Promise<SupportFaqEntry[]>;
  /** ТЗ п.15.21 — админ-панель видит и неактивные записи тоже. */
  findAll(): Promise<SupportFaqEntry[]>;
  create(entry: NewSupportFaqEntry): Promise<SupportFaqEntry>;
  update(id: string, input: UpdateSupportFaqEntry): Promise<SupportFaqEntry | null>;
}

export const SUPPORT_FAQ_REPOSITORY = Symbol("SUPPORT_FAQ_REPOSITORY");
