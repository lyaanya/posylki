import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { LISTINGS_REPOSITORY, type IListingsRepository } from "./listings.repository.js";

/**
 * ТЗ п.7.17: рейс архивируется после даты вылета, заявка — после верхней
 * границы диапазона дат. Раз в час, а не по запросу (см. технические
 * детали эпика) — публикаций мало, ежечасного прохода достаточно.
 */
@Injectable()
export class ListingsArchiveService {
  private readonly logger = new Logger(ListingsArchiveService.name);

  constructor(@Inject(LISTINGS_REPOSITORY) private readonly listings: IListingsRepository) {}

  @Cron(CronExpression.EVERY_HOUR)
  async archiveExpiredListings(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const expiredIds = await this.listings.findExpiredPublishedIds(today);

    for (const id of expiredIds) {
      await this.listings.setStatus(id, "archived");
    }

    if (expiredIds.length > 0) {
      this.logger.log(`Архивировано объявлений по истечении даты: ${expiredIds.length}`);
    }
  }
}
