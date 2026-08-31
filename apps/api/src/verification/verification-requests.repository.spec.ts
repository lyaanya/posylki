import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseVerificationRequestsRepository } from "./verification-requests.repository.supabase.js";

describe("SupabaseVerificationRequestsRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseVerificationRequestsRepository;
  let documentTypeId: string;
  const createdUserIds: string[] = [];

  async function createUser(): Promise<string> {
    const userId = randomUUID();
    await sql`insert into auth.users (id, email) values (${userId}, ${`verification-test-${userId}@example.com`})`.execute(
      db,
    );
    createdUserIds.push(userId);
    return userId;
  }

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseVerificationRequestsRepository(db);

    const documentType = await sql<{ id: string }>`select id from document_types limit 1`.execute(db);
    documentTypeId = documentType.rows[0]!.id;
  }, 20000);

  afterAll(async () => {
    await sql`delete from auth.users where id = any(${createdUserIds})`.execute(db);
    await db.destroy();
  });

  it("создаёт заявку и находит её как активную/последнюю для пользователя", async () => {
    const userId = await createUser();

    const created = await repository.create({
      userId,
      documentType: documentTypeId,
      submittedFirstName: "Иван",
      submittedLastName: "Тестов",
      submittedDateOfBirth: "1990-05-15",
      documentNumberHash: "hash-1",
      documentPhotoPath: `verification/${userId}/document.jpg`,
      selfiePhotoPath: `verification/${userId}/selfie.jpg`,
    });

    expect(created.status).toBe("pending");
    // Регрессия на баг сдвига даты через toISOString() при парсинге Postgres `date`.
    expect(created.submittedDateOfBirth).toBe("1990-05-15");

    const active = await repository.findActiveForUser(userId);
    expect(active?.id).toBe(created.id);

    const latest = await repository.findLatestForUser(userId);
    expect(latest?.id).toBe(created.id);

    const all = await repository.findAllForUser(userId);
    expect(all).toHaveLength(1);
  });

  it("findQueue возвращает только pending, от старых к новым", async () => {
    const userA = await createUser();
    const userB = await createUser();

    const older = await repository.create({
      userId: userA,
      documentType: documentTypeId,
      submittedFirstName: "А",
      submittedLastName: "Тестов",
      submittedDateOfBirth: "1990-01-01",
      documentNumberHash: `hash-queue-a-${userA}`,
      documentPhotoPath: "x",
      selfiePhotoPath: "x",
    });
    await sql`update verification_requests set created_at = now() - interval '2 days' where id = ${older.id}`.execute(db);

    const newer = await repository.create({
      userId: userB,
      documentType: documentTypeId,
      submittedFirstName: "Б",
      submittedLastName: "Тестов",
      submittedDateOfBirth: "1990-01-01",
      documentNumberHash: `hash-queue-b-${userB}`,
      documentPhotoPath: "x",
      selfiePhotoPath: "x",
    });

    const queue = await repository.findQueue();
    const ids = queue.map((r) => r.id);
    expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
    for (const item of queue) {
      expect(item.status).toBe("pending");
    }
  });

  it("decide(approved) очищает причину отклонения и фото, проставляет решившего", async () => {
    const userId = await createUser();
    const request = await repository.create({
      userId,
      documentType: documentTypeId,
      submittedFirstName: "В",
      submittedLastName: "Тестов",
      submittedDateOfBirth: "1990-01-01",
      documentNumberHash: `hash-decide-approve-${userId}`,
      documentPhotoPath: "x",
      selfiePhotoPath: "x",
    });
    const adminId = randomUUID();
    await sql`insert into auth.users (id, email) values (${adminId}, ${`verification-admin-${adminId}@example.com`})`.execute(
      db,
    );
    await sql`insert into admin_users (id, email, full_name, role) values (${adminId}, ${`verification-admin-${adminId}@example.com`}, 'Тест Модератор', 'moderator')`.execute(
      db,
    );
    createdUserIds.push(adminId);

    const decided = await repository.decide(request.id, { approved: true, adminId });

    expect(decided?.status).toBe("approved");
    expect(decided?.rejectionReasonCode).toBeNull();
    expect(decided?.documentPhotoPath).toBeNull();
    expect(decided?.selfiePhotoPath).toBeNull();
    expect(decided?.reviewedByAdminId).toBe(adminId);
    expect(decided?.reviewedAt).not.toBeNull();
  });

  it("decide(rejected, adminId=null) — автоматическое закрытие по таймауту (E04 п.4.16)", async () => {
    const userId = await createUser();
    const request = await repository.create({
      userId,
      documentType: documentTypeId,
      submittedFirstName: "Г",
      submittedLastName: "Тестов",
      submittedDateOfBirth: "1990-01-01",
      documentNumberHash: `hash-decide-timeout-${userId}`,
      documentPhotoPath: "x",
      selfiePhotoPath: "x",
    });

    const decided = await repository.decide(request.id, {
      approved: false,
      rejectionReasonCode: "review_timeout",
      adminId: null,
    });

    expect(decided?.status).toBe("rejected");
    expect(decided?.rejectionReasonCode).toBe("review_timeout");
    expect(decided?.reviewedByAdminId).toBeNull();
  });
});
