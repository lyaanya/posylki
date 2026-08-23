import { Inject, Injectable } from "@nestjs/common";
import { sql, type Kysely, type Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ICitiesRepository } from "./cities.repository.js";
import type { City, CitiesTable, NewCity, UpdateCity } from "./directories.types.js";
import { expandLayoutVariants } from "./keyboard-layout.js";

function toEntity(row: Selectable<CitiesTable>): City {
  return {
    id: row.id,
    nameRu: row.name_ru,
    nameEn: row.name_en,
    countryCode: row.country_code,
    timezone: row.timezone,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    synonyms: row.synonyms,
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class SupabaseCitiesRepository implements ICitiesRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findAllActive(executor: Executor = this.db): Promise<City[]> {
    const rows = await executor
      .selectFrom("cities")
      .selectAll()
      .where("is_active", "=", true)
      .orderBy("sort_order", "asc")
      .execute();

    return rows.map(toEntity);
  }

  async findAll(executor: Executor = this.db): Promise<City[]> {
    const rows = await executor.selectFrom("cities").selectAll().orderBy("sort_order", "asc").execute();

    return rows.map(toEntity);
  }

  async findById(id: string, executor: Executor = this.db): Promise<City | null> {
    const row = await executor.selectFrom("cities").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? toEntity(row) : null;
  }

  async search(query: string, executor: Executor = this.db): Promise<City[]> {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
      return this.findAllActive(executor);
    }

    const variants = expandLayoutVariants(normalized);

    const rows = await executor
      .selectFrom("cities")
      .selectAll()
      .where("is_active", "=", true)
      .where((eb) =>
        eb.or(
          variants.flatMap((variant) => {
            const pattern = `%${variant}%`;
            return [
              eb("name_ru", "ilike", pattern),
              eb("name_en", "ilike", pattern),
              sql<boolean>`exists (select 1 from unnest(${eb.ref("synonyms")}) as syn where syn ilike ${pattern})`,
            ];
          }),
        ),
      )
      .orderBy("sort_order", "asc")
      .execute();

    return rows.map(toEntity);
  }

  async create(input: NewCity, executor: Executor = this.db): Promise<City> {
    const row = await executor
      .insertInto("cities")
      .values({
        name_ru: input.nameRu,
        name_en: input.nameEn,
        country_code: input.countryCode,
        timezone: input.timezone,
        sort_order: input.sortOrder ?? 0,
        synonyms: input.synonyms ?? [],
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toEntity(row);
  }

  async update(id: string, input: UpdateCity, executor: Executor = this.db): Promise<City | null> {
    const row = await executor
      .updateTable("cities")
      .set({
        ...(input.nameRu !== undefined && { name_ru: input.nameRu }),
        ...(input.nameEn !== undefined && { name_en: input.nameEn }),
        ...(input.countryCode !== undefined && { country_code: input.countryCode }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
        ...(input.sortOrder !== undefined && { sort_order: input.sortOrder }),
        ...(input.synonyms !== undefined && { synonyms: input.synonyms }),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async setActive(id: string, isActive: boolean, executor: Executor = this.db): Promise<City | null> {
    const row = await executor
      .updateTable("cities")
      .set({ is_active: isActive })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }
}
