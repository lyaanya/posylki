import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IWeightReferencesRepository } from "./weight-references.repository.js";
import type {
  NewWeightReference,
  UpdateWeightReference,
  WeightReference,
  WeightReferencesTable,
} from "./directories.types.js";

function toEntity(row: Selectable<WeightReferencesTable>): WeightReference {
  return {
    id: row.id,
    name: row.name,
    weightGrams: row.weight_grams,
    weightGramsMax: row.weight_grams_max,
    category: row.category,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class SupabaseWeightReferencesRepository implements IWeightReferencesRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findAllActive(executor: Executor = this.db): Promise<WeightReference[]> {
    const rows = await executor
      .selectFrom("weight_references")
      .selectAll()
      .where("is_active", "=", true)
      .orderBy("sort_order", "asc")
      .execute();

    return rows.map(toEntity);
  }

  async findById(id: string, executor: Executor = this.db): Promise<WeightReference | null> {
    const row = await executor
      .selectFrom("weight_references")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async create(input: NewWeightReference, executor: Executor = this.db): Promise<WeightReference> {
    const row = await executor
      .insertInto("weight_references")
      .values({
        name: input.name,
        weight_grams: input.weightGrams,
        weight_grams_max: input.weightGramsMax ?? null,
        category: input.category ?? null,
        sort_order: input.sortOrder ?? 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toEntity(row);
  }

  async update(
    id: string,
    input: UpdateWeightReference,
    executor: Executor = this.db,
  ): Promise<WeightReference | null> {
    const row = await executor
      .updateTable("weight_references")
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.weightGrams !== undefined && { weight_grams: input.weightGrams }),
        ...(input.weightGramsMax !== undefined && { weight_grams_max: input.weightGramsMax }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.sortOrder !== undefined && { sort_order: input.sortOrder }),
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
  ): Promise<WeightReference | null> {
    const row = await executor
      .updateTable("weight_references")
      .set({ is_active: isActive })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }
}
