import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { AuthUser, IUsersRepository } from "./users.repository.js";

@Injectable()
export class SupabaseUsersRepository implements IUsersRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async findById(id: string, executor: Executor = this.db): Promise<AuthUser | null> {
    const row = await executor
      .selectFrom("users")
      // Алиас обязателен: без него Kysely/Postgres ссылается на схемное
      // "auth.users" по последнему сегменту имени ("users"), что совпадает
      // с public.users в этом же запросе — "table reference is ambiguous".
      .innerJoin("auth.users as identity", "identity.id", "users.id")
      .select([
        "users.id as id",
        "users.email as email",
        "users.verification_status as verification_status",
        "users.is_blocked as is_blocked",
        "users.blocked_reason as blocked_reason",
        "users.deleted_at as deleted_at",
        "identity.email_confirmed_at as email_confirmed_at",
      ])
      .where("users.id", "=", id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      verificationStatus: row.verification_status,
      isBlocked: row.is_blocked,
      blockedReason: row.blocked_reason,
      deletedAt: row.deleted_at,
      emailConfirmed: row.email_confirmed_at !== null,
    };
  }

  async setBlocked(
    id: string,
    isBlocked: boolean,
    reason: string | null,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor
      .updateTable("users")
      .set({ is_blocked: isBlocked, blocked_reason: reason })
      .where("id", "=", id)
      .execute();
  }

  async softDelete(id: string, executor: Executor = this.db): Promise<void> {
    // Хэш документа (document_number_hash) и его тип намеренно не трогаем —
    // ТЗ E12 п.12.17: должны пережить удаление аккаунта, иначе заблокированный
    // удалил бы профиль и зарегистрировался заново на тот же документ.
    await executor
      .updateTable("users")
      .set({
        deleted_at: new Date().toISOString(),
        first_name: null,
        last_name: null,
        avatar_url: null,
        about_text: null,
        phone: null,
        city_id: null,
      })
      .where("id", "=", id)
      .execute();
  }

  async approveVerification(
    id: string,
    input: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      documentType: string;
      documentNumberHash: string;
      adminId: string;
    },
    executor: Executor = this.db,
  ): Promise<void> {
    await executor
      .updateTable("users")
      .set({
        first_name: input.firstName,
        last_name: input.lastName,
        date_of_birth: input.dateOfBirth,
        document_type: input.documentType,
        document_number_hash: input.documentNumberHash,
        verification_status: "approved",
        verified_at: new Date().toISOString(),
        verified_by_admin_id: input.adminId,
      })
      .where("id", "=", id)
      .execute();
  }

  async rejectVerification(id: string, executor: Executor = this.db): Promise<void> {
    await executor.updateTable("users").set({ verification_status: "rejected" }).where("id", "=", id).execute();
  }

  async isDocumentHashBanned(documentNumberHash: string, executor: Executor = this.db): Promise<boolean> {
    const row = await executor
      .selectFrom("users")
      .select("id")
      .where("document_number_hash", "=", documentNumberHash)
      .where((eb) => eb.or([eb("is_blocked", "=", true), eb("deleted_at", "is not", null)]))
      .executeTakeFirst();
    return row !== undefined;
  }
}
