import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { CHAT_REPOSITORY, type IChatRepository } from "../chat/chat.repository.js";
import type { DB, Executor } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import { runInTransaction } from "../database/database.js";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "../listings/listings.repository.js";
import { notificationCopy } from "../notifications/notification-copy.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PROFILE_REPOSITORY, type IProfileRepository } from "../profile/profile.repository.js";
import { assertDealTransitionAllowed } from "./deal-state-machine.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "./deals.repository.js";
import type { Deal, DealCancelReason, DealStatus } from "./deals.types.js";

/** Системные сообщения в чате по каждому переходу (ТЗ п.10.3). */
const STATUS_MESSAGES: Record<DealStatus, string> = {
  responded: "Оформлена сделка по этому объявлению",
  agreed: "Условия сделки согласованы, вес зарезервирован",
  handed_over: "Посылка передана курьеру",
  in_transit: "Курьер в пути",
  awaiting_pickup: "Курьер на месте, посылку можно забрать",
  delivered: "Посылка выдана",
  completed: "Сделка завершена",
  cancelled: "Сделка отменена",
  problem: "Сделка помечена как проблемная — потребуется разбор",
};

/**
 * Единая точка входа для переходов статуса и их побочных эффектов (журнал,
 * системное сообщение в чате, резерв/возврат веса, счётчики профиля) —
 * общая для DealsController (ручные действия) и DealsCronService
 * (автопереходы по расписанию), чтобы не дублировать эту логику дважды.
 */
@Injectable()
export class DealsTransitionsService {
  constructor(
    @Inject(DATABASE) private readonly db: Kysely<DB>,
    @Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository,
    @Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository,
    @Inject(CHAT_REPOSITORY) private readonly chats: IChatRepository,
    @Inject(PROFILE_REPOSITORY) private readonly profiles: IProfileRepository,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async transition(
    deal: Deal,
    to: DealStatus,
    actorId: string | null,
    comment: string | null = null,
    executor: Executor = this.db,
  ): Promise<void> {
    assertDealTransitionAllowed(deal.status, to);
    await this.deals.setStatus(deal.id, to, executor);
    await this.deals.logStatusChange(deal.id, deal.status, to, actorId, comment, executor);
    await this.chats.createSystemMessage(deal.chatId, STATUS_MESSAGES[to], executor);
    await this.notifyTransition(deal, to, actorId);
  }

  /**
   * ТЗ E14 п.14.5 — "Смена статуса сделки" (всегда срочно). "Сделка
   * создана" сюда не попадает: начальный статус responded выставляется
   * прямо в DealsRepository.create (см. deals.controller.ts create()),
   * а не через этот метод — уведомление для него отдельно там же.
   * Уведомляем сторону, которая не инициировала переход; при системном
   * переходе (actorId === null, cron) — обе стороны.
   */
  private async notifyTransition(deal: Deal, to: DealStatus, actorId: string | null): Promise<void> {
    const recipients = [deal.customer, deal.courier].filter((p) => p.id !== actorId);
    for (const recipient of recipients) {
      await this.notifications.notify({
        userId: recipient.id,
        event: "deal_status_changed",
        copy: notificationCopy.dealStatusChanged(STATUS_MESSAGES[to], deal.id),
        payload: { dealId: deal.id },
      });
    }
  }

  /** ТЗ п.10.5/10.8 — резервирует вес и переводит в agreed одной транзакцией. */
  async tryEnterAgreed(deal: Deal, actorId: string): Promise<{ ok: true } | { ok: false; code: string }> {
    return runInTransaction(this.db, async (trx) => {
      const reserved = await this.listings.reserveWeight(deal.listingId, deal.declaredWeightGrams!, trx);
      if (!reserved) {
        return { ok: false, code: "NOT_ENOUGH_WEIGHT" };
      }
      await this.deals.setReservedWeight(deal.id, deal.declaredWeightGrams!, trx);
      const listing = await this.listings.findById(deal.listingId, trx);
      if (listing?.storageUntilDate) {
        await this.deals.setStorageUntilDate(deal.id, listing.storageUntilDate, trx);
      }
      await this.transition(deal, "agreed", actorId, null, trx);
      return { ok: true };
    });
  }

  /** ТЗ п.10.38 — до handed_over без последствий, возвращает весь удержанный вес. */
  async cancel(
    deal: Deal,
    reason: DealCancelReason,
    comment: string | null,
    actorId: string,
  ): Promise<void> {
    await runInTransaction(this.db, async (trx) => {
      if (deal.reservedWeightGrams) {
        await this.listings.releaseWeight(deal.listingId, deal.reservedWeightGrams, trx);
      }
      await this.deals.setCancellation(deal.id, reason, comment, trx);
      await this.transition(deal, "cancelled", actorId, comment, trx);
    });
  }

  async markProblem(deal: Deal, comment: string | null): Promise<void> {
    await this.transition(deal, "problem", null, comment);
  }

  /** ТЗ п.10.37 — завершение увеличивает счётчики сделок в профилях обеих сторон. */
  async complete(deal: Deal, actorId: string | null): Promise<void> {
    await runInTransaction(this.db, async (trx) => {
      await this.transition(deal, "completed", actorId, null, trx);
      await this.profiles.incrementDealsCount(deal.customer.id, "customer", trx);
      await this.profiles.incrementDealsCount(deal.courier.id, "courier", trx);
    });
  }
}
