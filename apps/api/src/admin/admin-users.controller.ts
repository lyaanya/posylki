import { Body, Controller, Get, HttpStatus, Inject, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Kysely } from "kysely";
import { AdminGuard } from "./admin.guard.js";
import { CurrentAdmin } from "./current-admin.decorator.js";
import type { AdminUser } from "./admin-user.repository.js";
import { AppException } from "../common/app-exception.js";
import type { DB } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import { BANS_REPOSITORY, type IBansRepository } from "../moderation/bans.repository.js";
import { COMPLAINTS_REPOSITORY, type IComplaintsRepository } from "../moderation/complaints.repository.js";
import { WARNINGS_REPOSITORY, type IWarningsRepository } from "../moderation/warnings.repository.js";
import { ModerationActionsService } from "../moderation/moderation-actions.service.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "../deals/deals.repository.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "../listings/listings.repository.js";
import { REVIEWS_REPOSITORY, type IReviewsRepository } from "../reviews/reviews.repository.js";
import { ModerateUserDto } from "./dto/moderate-user.dto.js";

interface AdminUserSearchResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  verificationStatus: string;
  isBlocked: boolean;
  createdAt: Date;
}

/**
 * ТЗ E16 пп.16.17-16.20 — поиск и карточка пользователя. Номер документа
 * нигде не запрашивается и не возвращается (16.20) — его нет в базе
 * (только хэш, и даже тот сюда не включён намеренно). "Привязанные
 * способы входа" (16.18) не реализованы: они живут в собственных
 * таблицах Supabase Auth, которые это приложение не моделирует в Kysely —
 * см. отчёт эпика.
 */
@ApiTags("admin/users")
@UseGuards(AdminGuard)
@Controller("admin/users")
export class AdminUsersController {
  constructor(
    @Inject(DATABASE) private readonly db: Kysely<DB>,
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(REVIEWS_REPOSITORY) private readonly reviews: IReviewsRepository,
    @Inject(COMPLAINTS_REPOSITORY) private readonly complaints: IComplaintsRepository,
    @Inject(WARNINGS_REPOSITORY) private readonly warnings: IWarningsRepository,
    @Inject(BANS_REPOSITORY) private readonly bans: IBansRepository,
    @Inject(ModerationActionsService) private readonly actions: ModerationActionsService,
  ) {}

  /** ТЗ п.16.17 — по имени, почте, идентификатору, телефону. */
  @Get("search")
  async search(@Query("q") q?: string): Promise<AdminUserSearchResult[]> {
    const query = (q ?? "").trim();
    if (query.length === 0) return [];

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
    const like = `%${query}%`;

    let builder = this.db
      .selectFrom("users")
      .select([
        "id",
        "email",
        "first_name",
        "last_name",
        "phone",
        "verification_status",
        "is_blocked",
        "created_at",
      ])
      .where("deleted_at", "is", null)
      .limit(50);

    builder = isUuid
      ? builder.where("id", "=", query)
      : builder.where((eb) =>
          eb.or([
            eb("email", "ilike", like),
            eb("first_name", "ilike", like),
            eb("last_name", "ilike", like),
            eb("phone", "ilike", like),
          ]),
        );

    const rows = await builder.execute();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      verificationStatus: row.verification_status,
      isBlocked: row.is_blocked,
      createdAt: row.created_at,
    }));
  }

  /** ТЗ п.16.18 — профиль, статус верификации, объявления, сделки, отзывы, жалобы, предупреждения, блокировки, кто пригласил. */
  @Get(":id")
  async card(@Param("id") id: string) {
    const user = await this.db
      .selectFrom("users")
      .leftJoin("users as referrer", "referrer.id", "users.referred_by_id")
      .select([
        "users.id as id",
        "users.email as email",
        "users.phone as phone",
        "users.first_name as first_name",
        "users.last_name as last_name",
        "users.date_of_birth as date_of_birth",
        "users.document_type as document_type",
        "users.verification_status as verification_status",
        "users.verified_at as verified_at",
        "users.is_blocked as is_blocked",
        "users.blocked_reason as blocked_reason",
        "users.deleted_at as deleted_at",
        "users.created_at as created_at",
        "users.referred_by_id as referred_by_id",
        "referrer.email as referrer_email",
      ])
      .where("users.id", "=", id)
      .executeTakeFirst();

    if (!user) throw new NotFoundException("Пользователь не найден");

    const [listings, dealsList, reviewsReceivedPage, complaintsFiled, complaintsReceived, warningsList, bansList] =
      await Promise.all([
        this.listings.findByOwner(id),
        this.deals.findForUser(id),
        this.reviews.findPublishedForUser(id, { limit: 50 }),
        this.complaints.findByAuthor(id),
        this.complaints.findPastAgainstUser(id),
        this.warnings.findByUser(id),
        this.bans.findByUser(id),
      ]);
    const reviewsReceived = reviewsReceivedPage.items;

    return {
      profile: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: user.date_of_birth,
        documentType: user.document_type,
        verificationStatus: user.verification_status,
        verifiedAt: user.verified_at,
        isBlocked: user.is_blocked,
        blockedReason: user.blocked_reason,
        deletedAt: user.deleted_at,
        createdAt: user.created_at,
        referredById: user.referred_by_id,
        referrerEmail: user.referrer_email,
      },
      listings,
      deals: dealsList,
      reviewsReceived,
      complaintsFiled,
      complaintsReceived,
      warnings: warningsList,
      bans: bansList,
    };
  }

  /** ТЗ п.16.19 — вынести предупреждение или заблокировать/разблокировать, причина обязательна. */
  @Post(":id/moderate")
  async moderate(
    @Param("id") id: string,
    @Body() dto: ModerateUserDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<{ ok: true }> {
    if (dto.action === "unban") {
      const activeBan = await this.bans.findActiveForUser(id);
      if (!activeBan) {
        throw new AppException({
          code: "NO_ACTIVE_BAN",
          message: "У пользователя нет действующей блокировки",
          status: HttpStatus.BAD_REQUEST,
        });
      }
      await this.actions.unban(id, activeBan.id, admin.id, dto.reason);
      return { ok: true };
    }

    await this.actions.apply({
      moderatorId: admin.id,
      action: dto.action,
      reason: dto.reason,
      complaintId: null,
      userId: id,
      banDurationDays: dto.banDurationDays ?? null,
    });
    return { ok: true };
  }
}
