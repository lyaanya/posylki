import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseBansRepository } from "./bans.repository.supabase.js";
import { SupabaseComplaintsRepository } from "./complaints.repository.supabase.js";
import { SupabaseWarningsRepository } from "./warnings.repository.supabase.js";
import type { IComplaintPhotoStorage } from "./complaint-photo-storage.js";

describe("Moderation repositories", () => {
  let db: Kysely<DB>;
  let complaints: SupabaseComplaintsRepository;
  let warnings: SupabaseWarningsRepository;
  let bans: SupabaseBansRepository;
  let authorId: string;
  let subjectId: string;
  const createdUserIds: string[] = [];

  const fakePhotoStorage: IComplaintPhotoStorage = {
    upload: vi.fn(async () => "fake/photo.jpg"),
    createSignedUrl: vi.fn(async (path: string) => `https://signed.example/${path}`),
  };

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    complaints = new SupabaseComplaintsRepository(db, fakePhotoStorage);
    warnings = new SupabaseWarningsRepository(db);
    bans = new SupabaseBansRepository(db);

    authorId = randomUUID();
    subjectId = randomUUID();
    await sql`insert into auth.users (id, email) values (${authorId}, ${`complaint-author-${authorId}@example.com`})`.execute(
      db,
    );
    await sql`insert into auth.users (id, email) values (${subjectId}, ${`complaint-subject-${subjectId}@example.com`})`.execute(
      db,
    );
    createdUserIds.push(authorId, subjectId);
  }, 20000);

  afterAll(async () => {
    await sql`delete from auth.users where id = any(${createdUserIds})`.execute(db);
    await db.destroy();
  }, 20000);

  it(
    "жалоба: создаётся, вторая активная на ту же цель отклоняется на уровне базы, статус меняется",
    async () => {
      const complaint = await complaints.create({
        authorId,
        targetType: "user",
        targetId: subjectId,
        category: "rudeness",
        comment: "Грубил в переписке",
        photoPaths: ["some/path.jpg"],
      });

      expect(complaint.status).toBe("pending");
      expect(complaint.photoUrls).toEqual(["https://signed.example/some/path.jpg"]);

      const active = await complaints.findActive(authorId, "user", subjectId);
      expect(active?.id).toBe(complaint.id);

      // ТЗ п.12.5 — вторая активная жалоба того же автора на ту же цель невозможна
      // (partial unique index complaints_one_active_per_target).
      await expect(
        sql`insert into complaints (author_id, target_type, target_id, category)
            values (${authorId}, 'user', ${subjectId}, 'spam')`.execute(db),
      ).rejects.toThrow();

      const resolved = await complaints.setStatus(complaint.id, "resolved");
      expect(resolved?.status).toBe("resolved");

      // После решения новая жалоба на ту же цель уже не блокируется.
      const secondComplaint = await complaints.create({
        authorId,
        targetType: "user",
        targetId: subjectId,
        category: "spam",
        comment: null,
        photoPaths: [],
      });
      expect(secondComplaint.id).not.toBe(complaint.id);

      const queue = await complaints.findQueue();
      expect(queue.map((c) => c.id)).toContain(secondComplaint.id);
      expect(queue.map((c) => c.id)).not.toContain(complaint.id);

      const pastAgainstSubject = await complaints.findPastAgainstUser(subjectId);
      expect(pastAgainstSubject.map((c) => c.id)).toEqual(
        expect.arrayContaining([complaint.id, secondComplaint.id]),
      );
    },
    20000,
  );

  it("предупреждение: показывается как непрочитанное, подтверждение работает один раз", async () => {
    const warning = await warnings.create({
      userId: subjectId,
      issuedBy: null,
      complaintId: null,
      reason: "Первое предупреждение",
    });
    expect(warning.acknowledgedAt).toBeNull();

    const oldest = await warnings.findOldestUnacknowledged(subjectId);
    expect(oldest?.id).toBe(warning.id);

    const acknowledged = await warnings.acknowledge(warning.id, subjectId);
    expect(acknowledged?.acknowledgedAt).not.toBeNull();

    const noneLeft = await warnings.findOldestUnacknowledged(subjectId);
    expect(noneLeft).toBeNull();

    // Повторное подтверждение уже подтверждённого — идемпотентно: апдейт не
    // находит строку (acknowledged_at уже не null), но метод всё равно
    // отдаёт текущее состояние строки, а не ошибку и не null.
    const again = await warnings.acknowledge(warning.id, subjectId);
    expect(again?.acknowledgedAt).toEqual(acknowledged?.acknowledgedAt);
  });

  it(
    "блокировка: создаётся, находится как активная, снимается с обязательной причиной",
    async () => {
      const ban = await bans.create({
        userId: subjectId,
        bannedBy: null,
        complaintId: null,
        reason: "Мошенничество",
        bannedUntil: null,
      });
      expect(ban.isActive).toBe(true);
      expect(ban.bannedUntil).toBeNull();

      const active = await bans.findActiveForUser(subjectId);
      expect(active?.id).toBe(ban.id);

      const unbanned = await bans.unban(ban.id, null, "Разобрались, ошибка");
      expect(unbanned?.isActive).toBe(false);

      const activeAfter = await bans.findActiveForUser(subjectId);
      expect(activeAfter).toBeNull();
    },
    15000,
  );

  it("findExpiredActive находит только просроченные временные блокировки", async () => {
    const pastDate = new Date();
    pastDate.setUTCDate(pastDate.getUTCDate() - 1);
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 1);

    const expiredBan = await bans.create({
      userId: subjectId,
      bannedBy: null,
      complaintId: null,
      reason: "Временная, уже истекла",
      bannedUntil: pastDate,
    });
    const activeBan = await bans.create({
      userId: subjectId,
      bannedBy: null,
      complaintId: null,
      reason: "Временная, ещё действует",
      bannedUntil: futureDate,
    });

    const expired = await bans.findExpiredActive(new Date());
    const expiredIds = expired.map((b) => b.id);
    expect(expiredIds).toContain(expiredBan.id);
    expect(expiredIds).not.toContain(activeBan.id);

    await bans.unban(expiredBan.id, null, "cleanup");
    await bans.unban(activeBan.id, null, "cleanup");
  });
});
