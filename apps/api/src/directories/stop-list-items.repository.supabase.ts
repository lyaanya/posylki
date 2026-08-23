import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IStopListItemsRepository } from "./stop-list-items.repository.js";
import type {
  NewStopListItem,
  StopListItem,
  StopListItemsTable,
  UpdateStopListItem,
} from "./directories.types.js";

function toEntity(row: Selectable<StopListItemsTable>): StopListItem {
  return {
    id: row.id,
    name: row.name,
    explanation: row.explanation,
    category: row.category,
    countryCode: row.country_code,
    isActive: row.is_active,
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class SupabaseStopListItemsRepository implements IStopListItemsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findAllActive(country?: string, executor: Executor = this.db): Promise<StopListItem[]> {
    let q = executor.selectFrom("stop_list_items").selectAll().where("is_active", "=", true);

    // Правило "везде" (country_code is null) действует всегда; правило
    // конкретной страны — только если она передана и совпадает.
    q = country
      ? q.where((eb) => eb.or([eb("country_code", "is", null), eb("country_code", "=", country)]))
      : q.where("country_code", "is", null);

    const rows = await q.orderBy("name", "asc").execute();
    return rows.map(toEntity);
  }

  async findById(id: string, executor: Executor = this.db): Promise<StopListItem | null> {
    const row = await executor
      .selectFrom("stop_list_items")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async create(input: NewStopListItem, executor: Executor = this.db): Promise<StopListItem> {
    const row = await executor
      .insertInto("stop_list_items")
      .values({
        name: input.name,
        explanation: input.explanation ?? null,
        category: input.category ?? null,
        country_code: input.countryCode ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toEntity(row);
  }

  async update(
    id: string,
    input: UpdateStopListItem,
    executor: Executor = this.db,
  ): Promise<StopListItem | null> {
    const row = await executor
      .updateTable("stop_list_items")
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.explanation !== undefined && { explanation: input.explanation }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.countryCode !== undefined && { country_code: input.countryCode }),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async setActive(
    id: string,
    isActive: boolean,
    executor: Executor = this.db,
  ): Promise<StopListItem | null> {
    const row = await executor
      .updateTable("stop_list_items")
      .set({ is_active: isActive })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }
}
