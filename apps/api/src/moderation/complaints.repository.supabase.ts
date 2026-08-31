import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import { COMPLAINT_PHOTO_STORAGE, type IComplaintPhotoStorage } from "./complaint-photo-storage.js";
import type { IComplaintsRepository } from "./complaints.repository.js";
import type { Complaint, ComplaintStatus, ComplaintTargetType, NewComplaint } from "./moderation.types.js";

interface ComplaintRow {
  id: string;
  author_id: string;
  target_type: ComplaintTargetType;
  target_id: string;
  category: Complaint["category"];
  comment: string | null;
  photo_paths: string[];
  status: ComplaintStatus;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SupabaseComplaintsRepository implements IComplaintsRepository {
  constructor(
    @Inject(DATABASE) private readonly db: Kysely<DB>,
    @Inject(COMPLAINT_PHOTO_STORAGE) private readonly photoStorage: IComplaintPhotoStorage,
  ) {}

  private async toEntity(row: ComplaintRow): Promise<Complaint> {
    const photoUrls = await Promise.all(row.photo_paths.map((path) => this.photoStorage.createSignedUrl(path)));
    return {
      id: row.id,
      authorId: row.author_id,
      targetType: row.target_type,
      targetId: row.target_id,
      category: row.category,
      comment: row.comment,
      photoUrls,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(input: NewComplaint, executor: Executor = this.db): Promise<Complaint> {
    const inserted = await executor
      .insertInto("complaints")
      .values({
        author_id: input.authorId,
        target_type: input.targetType,
        target_id: input.targetId,
        category: input.category,
        comment: input.comment,
        photo_paths: input.photoPaths,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toEntity(inserted as ComplaintRow);
  }

  async findById(id: string, executor: Executor = this.db): Promise<Complaint | null> {
    const row = await executor.selectFrom("complaints").selectAll().where("id", "=", id).executeTakeFirst();
    return row ? this.toEntity(row as ComplaintRow) : null;
  }

  async findActive(
    authorId: string,
    targetType: ComplaintTargetType,
    targetId: string,
    executor: Executor = this.db,
  ): Promise<Complaint | null> {
    const row = await executor
      .selectFrom("complaints")
      .selectAll()
      .where("author_id", "=", authorId)
      .where("target_type", "=", targetType)
      .where("target_id", "=", targetId)
      .where("status", "in", ["pending", "reviewing"])
      .executeTakeFirst();
    return row ? this.toEntity(row as ComplaintRow) : null;
  }

  async findByAuthor(authorId: string, executor: Executor = this.db): Promise<Complaint[]> {
    const rows = await executor
      .selectFrom("complaints")
      .selectAll()
      .where("author_id", "=", authorId)
      .orderBy("created_at", "desc")
      .execute();
    return Promise.all(rows.map((row) => this.toEntity(row as ComplaintRow)));
  }

  async findQueue(executor: Executor = this.db): Promise<Complaint[]> {
    const rows = await executor
      .selectFrom("complaints")
      .selectAll()
      .where("status", "in", ["pending", "reviewing"])
      .orderBy("created_at", "asc")
      .execute();
    return Promise.all(rows.map((row) => this.toEntity(row as ComplaintRow)));
  }

  async findPastAgainstUser(userId: string, executor: Executor = this.db): Promise<Complaint[]> {
    const rows = await executor
      .selectFrom("complaints")
      .selectAll()
      .where("target_type", "=", "user")
      .where("target_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return Promise.all(rows.map((row) => this.toEntity(row as ComplaintRow)));
  }

  async setStatus(id: string, status: ComplaintStatus, executor: Executor = this.db): Promise<Complaint | null> {
    await executor.updateTable("complaints").set({ status }).where("id", "=", id).execute();
    return this.findById(id, executor);
  }
}
