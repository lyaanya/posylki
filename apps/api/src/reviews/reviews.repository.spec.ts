import { randomUUID } from "node:crypto";
import { Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type DB } from "../database/database.js";
import { SupabaseReviewsRepository } from "./reviews.repository.supabase.js";

describe("SupabaseReviewsRepository", () => {
  let db: Kysely<DB>;
  let repository: SupabaseReviewsRepository;
  let customerId: string;
  let courierId: string;
  let dealId: string;
  const createdUserIds: string[] = [];
  const createdListingIds: string[] = [];

  async function createCompletedDeal(): Promise<string> {
    const moscow = await sql<{ id: string }>`select id from cities where name_ru = 'Москва'`.execute(db);
    const nhaTrang = await sql<{ id: string }>`select id from cities where name_ru = 'Нячанг'`.execute(db);
    const rub = await sql<{ id: string }>`select id from currencies where code = 'RUB'`.execute(db);

    const listingId = randomUUID();
    await sql`
      insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor)
      values (${listingId}, ${courierId}, 'trip', ${moscow.rows[0]!.id}, ${nhaTrang.rows[0]!.id}, ${rub.rows[0]!.id}, '2027-01-01', '2027-01-01', 5000, 100000, 300000)
    `.execute(db);
    createdListingIds.push(listingId);

    const chatId = randomUUID();
    await sql`insert into chats (id, listing_id, owner_id, other_user_id) values (${chatId}, ${listingId}, ${courierId}, ${customerId})`.execute(
      db,
    );

    const newDealId = randomUUID();
    await sql`
      insert into deals (id, chat_id, listing_id, customer_id, courier_id, currency_id, status)
      values (${newDealId}, ${chatId}, ${listingId}, ${customerId}, ${courierId}, ${rub.rows[0]!.id}, 'completed')
    `.execute(db);
    await sql`insert into deal_status_log (deal_id, from_status, to_status, actor_id) values (${newDealId}, 'delivered', 'completed', ${customerId})`.execute(
      db,
    );

    return newDealId;
  }

  beforeAll(async () => {
    const dbUrl = process.env["SUPABASE_DB_URL"];
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL не задан — см. .env.example");
    }
    db = createDatabase(dbUrl);
    repository = new SupabaseReviewsRepository(db);

    customerId = randomUUID();
    courierId = randomUUID();
    await sql`insert into auth.users (id, email) values (${customerId}, ${`review-customer-${customerId}@example.com`})`.execute(
      db,
    );
    await sql`insert into auth.users (id, email) values (${courierId}, ${`review-courier-${courierId}@example.com`})`.execute(
      db,
    );
    createdUserIds.push(customerId, courierId);
    await sql`update users set first_name = 'Заказчик', last_name = 'Тестов' where id = ${customerId}`.execute(db);
    await sql`update users set first_name = 'Курьер', last_name = 'Тестов' where id = ${courierId}`.execute(db);

    dealId = await createCompletedDeal();
  }, 20000);

  afterAll(async () => {
    await sql`delete from listings where id = any(${createdListingIds})`.execute(db);
    await sql`delete from auth.users where id = any(${createdUserIds})`.execute(db);
    await db.destroy();
  }, 20000);

  it(
    "слепая публикация: отзыв не публикуется, пока не написала вторая сторона; после — оба публикуются и рейтинг пересчитан",
    async () => {
      const customerReview = await repository.create({
        dealId,
        authorId: customerId,
        subjectId: courierId,
        role: "as_courier",
        rating: 5,
        text: "Отличный курьер",
      });
      expect(customerReview.publishedAt).toBeNull();
      expect(customerReview.author.name).toBe("Заказчик Тестов");

      const stillHidden = await repository.findByDealAndAuthor(dealId, customerId);
      expect(stillHidden?.publishedAt).toBeNull();

      const both = await repository.findByDeal(dealId);
      expect(both).toHaveLength(1); // курьер ещё не оставил свой

      const courierReview = await repository.create({
        dealId,
        authorId: courierId,
        subjectId: customerId,
        role: "as_customer",
        rating: 4,
        text: null,
      });

      const bothNow = await repository.findByDeal(dealId);
      expect(bothNow).toHaveLength(2);

      await repository.publishForDeal(dealId);
      await repository.recomputeRating(courierId, "as_courier");
      await repository.recomputeRating(customerId, "as_customer");

      const publishedCustomerSide = await repository.findByDealAndAuthor(dealId, customerId);
      const publishedCourierSide = await repository.findByDealAndAuthor(dealId, courierId);
      expect(publishedCustomerSide?.publishedAt).not.toBeNull();
      expect(publishedCourierSide?.publishedAt).not.toBeNull();

      const courierRating = await sql<{ courier_rating: string | null }>`select courier_rating from users where id = ${courierId}`.execute(
        db,
      );
      const customerRating = await sql<{ customer_rating: string | null }>`select customer_rating from users where id = ${customerId}`.execute(
        db,
      );
      expect(Number(courierRating.rows[0]!.courier_rating)).toBe(5);
      expect(Number(customerRating.rows[0]!.customer_rating)).toBe(4);

      expect(courierReview.role).toBe("as_customer");
    },
    15000,
  );

  it("findUnpublishedCreatedBefore находит только просроченные неопубликованные отзывы", async () => {
    const freshDealId = await createCompletedDeal();
    const review = await repository.create({
      dealId: freshDealId,
      authorId: customerId,
      subjectId: courierId,
      role: "as_courier",
      rating: 3,
      text: null,
    });

    const farFuture = new Date();
    farFuture.setUTCFullYear(farFuture.getUTCFullYear() + 1);
    const found = await repository.findUnpublishedCreatedBefore(farFuture);
    expect(found.map((r) => r.id)).toContain(review.id);

    const past = new Date();
    past.setUTCFullYear(past.getUTCFullYear() - 1);
    const notFound = await repository.findUnpublishedCreatedBefore(past);
    expect(notFound.map((r) => r.id)).not.toContain(review.id);
  });

  it(
    "findPublishedForUser отдаёт только опубликованные отзывы, пагинация работает",
    async () => {
      const dealA = await createCompletedDeal();
      const dealB = await createCompletedDeal();

      const reviewA = await repository.create({
        dealId: dealA,
        authorId: customerId,
        subjectId: courierId,
        role: "as_courier",
        rating: 5,
        text: "Первый",
      });
      const reviewB = await repository.create({
        dealId: dealB,
        authorId: customerId,
        subjectId: courierId,
        role: "as_courier",
        rating: 2,
        text: "Второй, ещё не опубликован",
      });

      await repository.publishSingle(reviewA.id);

      const page = await repository.findPublishedForUser(courierId, { limit: 20 });
      const ids = page.items.map((r) => r.id);
      expect(ids).toContain(reviewA.id);
      expect(ids).not.toContain(reviewB.id);
    },
    15000,
  );

  it(
    "moderateDelete обнуляет rating и text, не позволяя оставить новый отзыв по той же сделке",
    async () => {
    const freshDealId = await createCompletedDeal();
    const review = await repository.create({
      dealId: freshDealId,
      authorId: courierId,
      subjectId: customerId,
      role: "as_customer",
      rating: 1,
      text: "Оскорбление",
    });
    await repository.publishSingle(review.id);
    await repository.recomputeRating(customerId, "as_customer");

    const adminId = randomUUID();
    await sql`insert into auth.users (id, email) values (${adminId}, ${`review-admin-${adminId}@example.com`})`.execute(
      db,
    );
    await sql`insert into admin_users (id, email, full_name, role) values (${adminId}, ${`review-admin-${adminId}@example.com`}, 'Тест Модератор', 'moderator')`.execute(
      db,
    );
    createdUserIds.push(adminId);

    const moderated = await repository.moderateDelete(review.id, adminId, "Оскорбление личности");
    expect(moderated?.rating).toBeNull();
    expect(moderated?.text).toBeNull();

    await expect(
      repository.create({
        dealId: freshDealId,
        authorId: courierId,
        subjectId: customerId,
        role: "as_customer",
        rating: 5,
        text: "Попытка переписать",
      }),
    ).rejects.toThrow();
    },
    15000,
  );

  it("отзыв удалённого автора показывается как «Удалённый пользователь», isDeleted=true", async () => {
    const deletedAuthorId = randomUUID();
    await sql`insert into auth.users (id, email) values (${deletedAuthorId}, ${`review-deleted-${deletedAuthorId}@example.com`})`.execute(
      db,
    );
    await sql`update users set first_name = 'Скоро', last_name = 'Удалён', deleted_at = now() where id = ${deletedAuthorId}`.execute(
      db,
    );

    const freshDealId = randomUUID();
    const moscow = await sql<{ id: string }>`select id from cities where name_ru = 'Москва'`.execute(db);
    const nhaTrang = await sql<{ id: string }>`select id from cities where name_ru = 'Нячанг'`.execute(db);
    const rub = await sql<{ id: string }>`select id from currencies where code = 'RUB'`.execute(db);
    const listingId = randomUUID();
    await sql`
      insert into listings (id, owner_id, type, from_city_id, to_city_id, currency_id, date_from, date_to, weight_grams, price_per_kg_minor, min_price_minor)
      values (${listingId}, ${courierId}, 'trip', ${moscow.rows[0]!.id}, ${nhaTrang.rows[0]!.id}, ${rub.rows[0]!.id}, '2027-02-01', '2027-02-01', 5000, 100000, 300000)
    `.execute(db);
    const chatId = randomUUID();
    await sql`insert into chats (id, listing_id, owner_id, other_user_id) values (${chatId}, ${listingId}, ${courierId}, ${deletedAuthorId})`.execute(
      db,
    );
    await sql`
      insert into deals (id, chat_id, listing_id, customer_id, courier_id, currency_id, status)
      values (${freshDealId}, ${chatId}, ${listingId}, ${deletedAuthorId}, ${courierId}, ${rub.rows[0]!.id}, 'completed')
    `.execute(db);

    const review = await repository.create({
      dealId: freshDealId,
      authorId: deletedAuthorId,
      subjectId: courierId,
      role: "as_courier",
      rating: 5,
      text: "Отзыв от того, кто скоро удалится",
    });

    expect(review.author.name).toBe("Удалённый пользователь");
    expect(review.author.isDeleted).toBe(true);

    await sql`delete from listings where id = ${listingId}`.execute(db);
    await sql`delete from auth.users where id = ${deletedAuthorId}`.execute(db);
  });
});
