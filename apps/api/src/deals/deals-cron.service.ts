import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "./deals.repository.js";
import { DealsTransitionsService } from "./deals-transitions.service.js";

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Автопереходы (ТЗ п.10.13): вылет/прилёт, автозавершение через 7 дней,
 * истечение хранения, напоминания. Раз в час, как и архивация объявлений
 * (E07) — тот же простой сдвиг, без настоящего часового пояса города
 * (см. комментарий в deals.controller.ts).
 */
@Injectable()
export class DealsCronService {
  private readonly logger = new Logger(DealsCronService.name);

  constructor(
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(DealsTransitionsService) private readonly transitions: DealsTransitionsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const today = toDateString(new Date());

    const handedOver = await this.deals.findHandedOverPastDeparture(today);
    for (const deal of handedOver) {
      await this.transitions.transition(deal, "in_transit", null, "Автоматически по дате вылета");
    }

    const inTransit = await this.deals.findInTransitPastArrival(today);
    for (const deal of inTransit) {
      await this.transitions.transition(deal, "awaiting_pickup", null, "Автоматически по дате прилёта");
    }

    // ТЗ п.10.36 — автозавершение через 7 дней после delivered, если заказчик не подтвердил.
    const cutoff = addDays(new Date(), -7);
    const staleDelivered = await this.deals.findDeliveredBefore(cutoff);
    for (const deal of staleDelivered) {
      await this.transitions.complete(deal, null);
    }

    // ТЗ п.10.33 — истечение хранения без delivered помечает сделку проблемной.
    const overdue = await this.deals.findAwaitingPickupPastStorage(today);
    for (const deal of overdue) {
      await this.transitions.markProblem(deal, "Истёк срок хранения посылки");
    }

    // ТЗ п.10.31 — напоминания за три дня, за день и в день истечения.
    await this.sendReminders("3d", addDays(new Date(), 3));
    await this.sendReminders("1d", addDays(new Date(), 1));
    await this.sendReminders("expiry", new Date());

    const total = handedOver.length + inTransit.length + staleDelivered.length + overdue.length;
    if (total > 0) {
      this.logger.log(`Автопереходы сделок: ${total}`);
    }
  }

  private async sendReminders(kind: "3d" | "1d" | "expiry", targetDate: Date): Promise<void> {
    const deals = await this.deals.findForStorageReminder(kind, toDateString(targetDate));
    for (const deal of deals) {
      const text =
        kind === "expiry"
          ? "Сегодня истекает срок хранения посылки"
          : `До истечения срока хранения посылки осталось ${kind === "3d" ? "3 дня" : "1 день"}`;
      await this.chats.createSystemMessage(deal.chatId, text);
      await this.deals.markReminderSent(deal.id, kind);

      // ТЗ E14 п.14.5 — напоминание о сроке хранения, всегда срочно, обеим сторонам.
      const copy = notificationCopy.storageReminder(kind, deal.id);
      for (const userId of [deal.customer.id, deal.courier.id]) {
        await this.notifications.notify({ userId, event: "storage_reminder", copy, payload: { dealId: deal.id } });
      }
    }
  }
}
