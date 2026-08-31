import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AppException } from "../common/app-exception.js";
import { decodeCursor, InvalidCursorError, PaginationQueryDto, type PaginatedResponse } from "../common/pagination.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Public } from "../auth/public.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "../deals/deals.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { CreateReviewDto } from "./dto/create-review.dto.js";
import { REVIEWS_REPOSITORY, type IReviewsRepository } from "./reviews.repository.js";
import type { Review, ReviewRole } from "./reviews.types.js";

const REVIEW_WINDOW_DAYS = 30;

function authRequired(): AppException {
  return new AppException({
    code: "AUTH_REQUIRED",
    message: "Нужно войти в аккаунт",
    status: HttpStatus.UNAUTHORIZED,
  });
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Слепая публикация (ТЗ п.11.5) — вся проверка на бэкенде: чужой
 * неопубликованный отзыв не отдаётся клиенту ни в каком виде, даже
 * скрытом. Модерация (11.14-11.17) — отдельный контроллер
 * admin-reviews.controller.ts, только для сотрудников (AdminGuard).
 */
@ApiTags("reviews")
@Controller("reviews")
export class ReviewsController {
  constructor(
    @Inject(REVIEWS_REPOSITORY) private readonly reviews: IReviewsRepository,
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /**
   * ТЗ п.11.1-11.4 — только участник завершённой сделки, один отзыв на
   * сторону, окно 30 дней с момента completed. Публикация обеих сторон
   * одновременно наступает здесь же, если это был второй отзыв по сделке.
   */
  @Post()
  async create(@Body() dto: CreateReviewDto, @CurrentUser() user?: AuthUser): Promise<Review> {
    if (!user) throw authRequired();

    const deal = await this.deals.findById(dto.dealId);
    if (!deal) throw new NotFoundException("Сделка не найдена");
    if (deal.customer.id !== user.id && deal.courier.id !== user.id) {
      throw new ForbiddenException("Это не ваша сделка");
    }
    if (deal.status !== "completed") {
      throw new AppException({
        code: "DEAL_NOT_COMPLETED",
        message: "Отзыв можно оставить только по завершённой сделке",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const completedAt = [...deal.statusLog].reverse().find((l) => l.toStatus === "completed")?.createdAt;
    if (!completedAt || new Date() > addDays(completedAt, REVIEW_WINDOW_DAYS)) {
      throw new AppException({
        code: "REVIEW_WINDOW_EXPIRED",
        message: "Срок для отзыва по этой сделке истёк",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const existing = await this.reviews.findByDealAndAuthor(dto.dealId, user.id);
    if (existing) {
      throw new AppException({
        code: "REVIEW_ALREADY_EXISTS",
        message: "Вы уже оставили отзыв по этой сделке",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const isCustomer = user.id === deal.customer.id;
    const subjectId = isCustomer ? deal.courier.id : deal.customer.id;
    const role: ReviewRole = isCustomer ? "as_courier" : "as_customer";

    const created = await this.reviews.create({
      dealId: dto.dealId,
      authorId: user.id,
      subjectId,
      role,
      rating: dto.rating,
      text: dto.text ?? null,
    });

    // Если это уже второй отзыв по сделке — обе стороны публикуются разом (11.5).
    const both = await this.reviews.findByDeal(dto.dealId);
    if (both.length === 2) {
      await this.reviews.publishForDeal(dto.dealId);
      await Promise.all(both.map((r) => this.reviews.recomputeRating(r.subjectId, r.role)));
      await Promise.all(
        both.map((r) =>
          this.notifications.notify({
            userId: r.subjectId,
            event: "review_published",
            copy: notificationCopy.reviewPublished(dto.dealId),
            payload: { dealId: dto.dealId },
          }),
        ),
      );
    }

    return created;
  }

  /**
   * ТЗ п.11.6 — автор видит свой отзыв всегда; чужой отдаётся, только
   * если уже опубликован. Прямая проверка API для "второй стороне не видно".
   */
  @Get("by-deal/:dealId")
  async findByDeal(
    @Param("dealId") dealId: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<{ mine: Review | null; theirs: Review | null }> {
    if (!user) throw authRequired();
    const deal = await this.deals.findById(dealId);
    if (!deal) throw new NotFoundException("Сделка не найдена");
    if (deal.customer.id !== user.id && deal.courier.id !== user.id) {
      throw new ForbiddenException("Это не ваша сделка");
    }

    const all = await this.reviews.findByDeal(dealId);
    const mine = all.find((r) => r.author.id === user.id) ?? null;
    const theirsRaw = all.find((r) => r.author.id !== user.id) ?? null;
    const theirs = theirsRaw && theirsRaw.publishedAt ? theirsRaw : null;

    return { mine, theirs };
  }

  /** ТЗ п.11.18-11.19 — публичный список для профиля, только опубликованные. */
  @Public()
  @Get("user/:userId")
  async findForUser(
    @Param("userId") userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Review>> {
    let cursor: { sortValue: string; id: string } | undefined;
    if (query.cursor) {
      try {
        const decoded = decodeCursor<{ sortValue?: unknown; id?: unknown }>(query.cursor);
        if (typeof decoded.sortValue !== "string" || typeof decoded.id !== "string") {
          throw new InvalidCursorError();
        }
        cursor = { sortValue: decoded.sortValue, id: decoded.id };
      } catch {
        throw new AppException({
          code: "INVALID_CURSOR",
          message: "Некорректный курсор пагинации",
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    return this.reviews.findPublishedForUser(userId, { limit: query.limit, cursor });
  }
}
