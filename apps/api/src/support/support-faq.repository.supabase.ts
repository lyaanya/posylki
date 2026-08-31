import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { ISupportFaqRepository } from "./support-faq.repository.js";
import type { NewSupportFaqEntry, SupportFaqEntry, UpdateSupportFaqEntry } from "./support.types.js";

function toDomain(row: { id: string; question: string; answer: string; is_active: boolean }): SupportFaqEntry {
  return { id: row.id, question: row.question, answer: row.answer, isActive: row.is_active };
}

@Injectable()
export class SupabaseSupportFaqRepository implements ISupportFaqRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findAllActive(): Promise<SupportFaqEntry[]> {
    const rows = await this.db
      .selectFrom("support_faq")
      .selectAll()
      .where("is_active", "=", true)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map(toDomain);
  }

  async findAll(): Promise<SupportFaqEntry[]> {
    const rows = await this.db.selectFrom("support_faq").selectAll().orderBy("created_at", "asc").execute();
    return rows.map(toDomain);
  }

  async create(entry: NewSupportFaqEntry): Promise<SupportFaqEntry> {
    const row = await this.db
      .insertInto("support_faq")
      .values({ question: entry.question, answer: entry.answer })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async update(id: string, input: UpdateSupportFaqEntry): Promise<SupportFaqEntry | null> {
    const row = await this.db
      .updateTable("support_faq")
      .set({
        ...(input.question !== undefined && { question: input.question }),
        ...(input.answer !== undefined && { answer: input.answer }),
        ...(input.isActive !== undefined && { is_active: input.isActive }),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }
}
