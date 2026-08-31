import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IVerificationRequestsRepository } from "./verification-requests.repository.js";
import type {
  DecideVerificationInput,
  NewVerificationRequest,
  VerificationRejectionReason,
  VerificationRequest,
} from "./verification.types.js";

/**
 * node-postgres парсит `date` в Date-объект с локальными год/месяц/день
 * (не UTC) — берём их локальными геттерами, а не toISOString(), иначе
 * дата съезжает на день в зависимости от часового пояса сервера (см. тот
 * же приём в listings.repository.supabase.ts).
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDomain(row: {
  id: string;
  user_id: string;
  document_type: string;
  submitted_first_name: string;
  submitted_last_name: string;
  submitted_date_of_birth: Date;
  document_number_hash: string;
  document_photo_path: string | null;
  selfie_photo_path: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason_code: VerificationRejectionReason | null;
  rejection_comment: string | null;
  reviewed_by_admin_id: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): VerificationRequest {
  return {
    id: row.id,
    userId: row.user_id,
    documentType: row.document_type,
    submittedFirstName: row.submitted_first_name,
    submittedLastName: row.submitted_last_name,
    submittedDateOfBirth: formatDate(row.submitted_date_of_birth),
    documentNumberHash: row.document_number_hash,
    documentPhotoPath: row.document_photo_path,
    selfiePhotoPath: row.selfie_photo_path,
    status: row.status,
    rejectionReasonCode: row.rejection_reason_code,
    rejectionComment: row.rejection_comment,
    reviewedByAdminId: row.reviewed_by_admin_id,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class SupabaseVerificationRequestsRepository implements IVerificationRequestsRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async create(entry: NewVerificationRequest, executor: Executor = this.db): Promise<VerificationRequest> {
    const row = await executor
      .insertInto("verification_requests")
      .values({
        user_id: entry.userId,
        document_type: entry.documentType,
        submitted_first_name: entry.submittedFirstName,
        submitted_last_name: entry.submittedLastName,
        submitted_date_of_birth: entry.submittedDateOfBirth,
        document_number_hash: entry.documentNumberHash,
        document_photo_path: entry.documentPhotoPath,
        selfie_photo_path: entry.selfiePhotoPath,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findActiveForUser(userId: string): Promise<VerificationRequest | null> {
    const row = await this.db
      .selectFrom("verification_requests")
      .selectAll()
      .where("user_id", "=", userId)
      .where("status", "=", "pending")
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findLatestForUser(userId: string): Promise<VerificationRequest | null> {
    const row = await this.db
      .selectFrom("verification_requests")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findAllForUser(userId: string): Promise<VerificationRequest[]> {
    const rows = await this.db
      .selectFrom("verification_requests")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<VerificationRequest | null> {
    const row = await this.db.selectFrom("verification_requests").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findQueue(): Promise<VerificationRequest[]> {
    const rows = await this.db
      .selectFrom("verification_requests")
      .selectAll()
      .where("status", "=", "pending")
      .orderBy("created_at", "asc")
      .execute();
    return rows.map(toDomain);
  }

  async decide(id: string, input: DecideVerificationInput): Promise<VerificationRequest | null> {
    const row = await this.db
      .updateTable("verification_requests")
      .set({
        status: input.approved ? "approved" : "rejected",
        rejection_reason_code: input.approved ? null : (input.rejectionReasonCode ?? "other"),
        rejection_comment: input.approved ? null : (input.rejectionComment ?? null),
        reviewed_by_admin_id: input.adminId,
        reviewed_at: new Date().toISOString(),
        // ТЗ п.16.10/E04.15 — фото удаляются немедленно и безвозвратно после решения.
        document_photo_path: null,
        selfie_photo_path: null,
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }
}
