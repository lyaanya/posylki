import { Controller, Get, Inject, NotFoundException, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../admin/admin.guard.js";
import { DEALS_REPOSITORY, type IDealsRepository } from "./deals.repository.js";
import type { Deal, DealStatus } from "./deals.types.js";

/**
 * ТЗ E16 пп.16.21-16.23 — список и карточка сделки для админ-панели.
 * Ручного изменения статуса здесь нет и не будет: машина состояний
 * принадлежит пользователям (16.23) — модератор может только пометить
 * сделку проблемной и вынести решение через admin-moderation.controller.ts.
 */
@ApiTags("admin/deals")
@UseGuards(AdminGuard)
@Controller("admin/deals")
export class AdminDealsController {
  constructor(@Inject(DEALS_REPOSITORY) private readonly deals: IDealsRepository) {}

  @Get()
  async list(
    @Query("status") status?: DealStatus,
    @Query("fromCityId") fromCityId?: string,
    @Query("toCityId") toCityId?: string,
    @Query("participantUserId") participantUserId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ): Promise<Deal[]> {
    return this.deals.findAllForAdmin({ status, fromCityId, toCityId, participantUserId, dateFrom, dateTo });
  }

  @Get(":id")
  async detail(@Param("id") id: string): Promise<Deal> {
    const deal = await this.deals.findById(id);
    if (!deal) throw new NotFoundException("Сделка не найдена");
    return deal;
  }
}
