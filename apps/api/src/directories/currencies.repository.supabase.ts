import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ICurrenciesRepository } from "./currencies.repository.js";
import type { Currency, CurrenciesTable, NewCurrency, UpdateCurrency } from "./directories.types.js";

function toEntity(row: Selectable<CurrenciesTable>): Currency {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    decimalPlaces: row.decimal_places,
    isActive: row.is_active,
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class SupabaseCurrenciesRepository implements ICurrenciesRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findAllActive(executor: Executor = this.db): Promise<Currency[]> {
    const rows = await executor
      .selectFrom("currencies")
      .selectAll()
      .where("is_active", "=", true)
      .orderBy("code", "asc")
      .execute();

    return rows.map(toEntity);
  }

  async findByCode(code: string, executor: Executor = this.db): Promise<Currency | null> {
    const row = await executor
      .selectFrom("currencies")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async findById(id: string, executor: Executor = this.db): Promise<Currency | null> {
    const row = await executor
      .selectFrom("currencies")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async create(input: NewCurrency, executor: Executor = this.db): Promise<Currency> {
    const row = await executor
      .insertInto("currencies")
      .values({
        code: input.code,
        name: input.name,
        symbol: input.symbol,
        decimal_places: input.decimalPlaces,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toEntity(row);
  }

  async update(id: string, input: UpdateCurrency, executor: Executor = this.db): Promise<Currency | null> {
    const row = await executor
      .updateTable("currencies")
      .set({
        ...(input.code !== undefined && { code: input.code }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.symbol !== undefined && { symbol: input.symbol }),
        ...(input.decimalPlaces !== undefined && { decimal_places: input.decimalPlaces }),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async setActive(id: string, isActive: boolean, executor: Executor = this.db): Promise<Currency | null> {
    const row = await executor
      .updateTable("currencies")
      .set({ is_active: isActive })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }
}
