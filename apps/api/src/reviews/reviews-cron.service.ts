import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "../deals/deals.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { REVIEWS_REPOSITORY, type IReviewsRepository } from "./reviews.repository.js";

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_TEXT = "Не забудьте оставить отзыв о сделке — это помогает другим пользователям сервиса";

/**
 * Раз в час (ТЗ, тех. детали эпика): (1) публикует односторонние отзывы
 * старше 7 дней (11.5, второе условие) и (2) шлёт напоминания оставить
 * отзыв через сутки и через семь дней (11.21/11.7).
 *
 * Напоминания сравниваются по точному времени перехода в completed
 * (deal_status_log), а не по календарной дате, поэтому не нужен отдельный
 * "уже отправлено" флаг: часовое окно [now - N - 1ч, now - N) естественным
 * образом захватывает сделку ровно один раз при регулярных тиках крона.
 * Пропуск тика (перезапуск сервера) может пропустить напоминание — тот же
 * компромисс, что и везде в MVP, без выделенной таблицы "непрочитанных" событий.
 */
@Injectable()
export class ReviewsCronService {
  private readonly logger = new Logger(ReviewsCronService.name);

  constructor(
    @Inject(REVIEWS_REPOSITORY) private readonly reviews: IReviewsRepository,
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const now = new Date();

    const cutoff7d = new Date(now.getTime() - 7 * 24 * HOUR_MS);
    const stale = await this.reviews.findUnpublishedCreatedBefore(cutoff7d);
    for (const review of stale) {
      await this.reviews.publishSingle(review.id);
      await this.reviews.recomputeRating(review.subjectId, review.role);
      await this.notifications.notify({
        userId: review.subjectId,
        event: "review_published",
        copy: notificationCopy.reviewPublished(review.dealId),
        payload: { dealId: review.dealId },
      });
    }

    const remindersSent1d = await this.remind(now, 24 * HOUR_MS);
    const remindersSent7d = await this.remind(now, 7 * 24 * HOUR_MS);

    const total = stale.length + remindersSent1d + remindersSent7d;
    if (total > 0) {
      this.logger.log(
        `Отзывы: опубликовано односторонних — ${stale.length}, напоминаний отправлено — ${remindersSent1d + remindersSent7d}`,
      );
    }
  }

  private async remind(now: Date, msAgo: number): Promise<number> {
    const to = new Date(now.getTime() - msAgo);
    const from = new Date(to.getTime() - HOUR_MS);
    const deals = await this.deals.findCompletedInWindow(from, to);

    let sent = 0;
    for (const deal of deals) {
      const [customerReview, courierReview] = await Promise.all([
        this.reviews.findByDealAndAuthor(deal.id, deal.customer.id),
        this.reviews.findByDealAndAuthor(deal.id, deal.courier.id),
      ]);
      if (!customerReview || !courierReview) {
        await this.chats.createSystemMessage(deal.chatId, REMINDER_TEXT);
        const copy = notificationCopy.reviewReminder(deal.id);
        if (!customerReview) {
          await this.notifications.notify({ userId: deal.customer.id, event: "review_reminder", copy, payload: { dealId: deal.id } });
        }
        if (!courierReview) {
          await this.notifications.notify({ userId: deal.courier.id, event: "review_reminder", copy, payload: { dealId: deal.id } });
        }
        sent += 1;
      }
    }
    return sent;
  }
}
