import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Selectable } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IDocumentTypesRepository } from "./document-types.repository.js";
import type {
  DocumentType,
  DocumentTypesTable,
  NewDocumentType,
  UpdateDocumentType,
} from "./directories.types.js";

function toEntity(row: Selectable<DocumentTypesTable>): DocumentType {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.country_code,
    numberPattern: row.number_pattern,
    isActive: row.is_active,
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class SupabaseDocumentTypesRepository implements IDocumentTypesRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findAllActive(country?: string, executor: Executor = this.db): Promise<DocumentType[]> {
    let q = executor.selectFrom("document_types").selectAll().where("is_active", "=", true);
    q = country ? q.where("country_code", "=", country) : q;

    const rows = await q.orderBy("name", "asc").execute();
    return rows.map(toEntity);
  }

  async findById(id: string, executor: Executor = this.db): Promise<DocumentType | null> {
    const row = await executor
      .selectFrom("document_types")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }

  async create(input: NewDocumentType, executor: Executor = this.db): Promise<DocumentType> {
    const row = await executor
      .insertInto("document_types")
      .values({
        name: input.name,
        country_code: input.countryCode,
        number_pattern: input.numberPattern ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toEntity(row);
  }

  async update(
    id: string,
    input: UpdateDocumentType,
    executor: Executor = this.db,
  ): Promise<DocumentType | null> {
    const row = await executor
      .updateTable("document_types")
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.countryCode !== undefined && { country_code: input.countryCode }),
        ...(input.numberPattern !== undefined && { number_pattern: input.numberPattern }),
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
  ): Promise<DocumentType | null> {
    const row = await executor
      .updateTable("document_types")
      .set({ is_active: isActive })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return row ? toEntity(row) : null;
  }
}
