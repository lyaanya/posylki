import type { Executor } from "../database/database.js";
import type { Currency, NewCurrency, UpdateCurrency } from "./directories.types.js";

export interface ICurrenciesRepository {
  findAllActive(executor?: Executor): Promise<Currency[]>;
  /** ТЗ E16 п.16.26 — включая отключённые, для админ-панели. */
  findAll(executor?: Executor): Promise<Currency[]>;
  findByCode(code: string, executor?: Executor): Promise<Currency | null>;
  findById(id: string, executor?: Executor): Promise<Currency | null>;
  create(input: NewCurrency, executor?: Executor): Promise<Currency>;
  update(id: string, input: UpdateCurrency, executor?: Executor): Promise<Currency | null>;
  setActive(id: string, isActive: boolean, executor?: Executor): Promise<Currency | null>;
}

export const CURRENCIES_REPOSITORY = Symbol("CURRENCIES_REPOSITORY");
