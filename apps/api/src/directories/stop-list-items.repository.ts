import type { Executor } from "../database/database.js";
import type { NewStopListItem, StopListItem, UpdateStopListItem } from "./directories.types.js";

export interface IStopListItemsRepository {
  /** country_code = null означает "везде" (5.13); country передаётся, если известна страна назначения. */
  findAllActive(country?: string, executor?: Executor): Promise<StopListItem[]>;
  findById(id: string, executor?: Executor): Promise<StopListItem | null>;
  create(input: NewStopListItem, executor?: Executor): Promise<StopListItem>;
  update(id: string, input: UpdateStopListItem, executor?: Executor): Promise<StopListItem | null>;
  setActive(id: string, isActive: boolean, executor?: Executor): Promise<StopListItem | null>;
}

export const STOP_LIST_ITEMS_REPOSITORY = Symbol("STOP_LIST_ITEMS_REPOSITORY");
