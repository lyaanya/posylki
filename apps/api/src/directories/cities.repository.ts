import type { Executor } from "../database/database.js";
import type { City, NewCity, UpdateCity } from "./directories.types.js";

export interface ICitiesRepository {
  /** Активные города, отсортированные для показа в выборе (5.1). */
  findAllActive(executor?: Executor): Promise<City[]>;
  /** Все города, включая отключённые — для админки и уже сделанных объявлений (5.3). */
  findAll(executor?: Executor): Promise<City[]>;
  findById(id: string, executor?: Executor): Promise<City | null>;
  /** Поиск без учёта регистра/раскладки по обоим языкам и синонимам (5.2). */
  search(query: string, executor?: Executor): Promise<City[]>;
  create(input: NewCity, executor?: Executor): Promise<City>;
  update(id: string, input: UpdateCity, executor?: Executor): Promise<City | null>;
  /** Отключение вместо удаления (5.20) — единственный способ убрать запись. */
  setActive(id: string, isActive: boolean, executor?: Executor): Promise<City | null>;
}

export const CITIES_REPOSITORY = Symbol("CITIES_REPOSITORY");
