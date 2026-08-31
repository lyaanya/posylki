import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../admin/admin.guard.js";
import { Public } from "../auth/public.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
import { AI_REQUEST_LOG_REPOSITORY, type IAiRequestLogRepository } from "./ai-request-log.repository.js";
import {
  MODERATION_RESULTS_REPOSITORY,
  type IModerationResultsRepository,
} from "./moderation-results.repository.js";
import { ParseListingTextDto } from "./dto/parse-listing-text.dto.js";
import { ParseListingTextScenario } from "./scenarios/parse-listing-text.scenario.js";

/**
 * Временно публичный: E03 (вход) ещё не реализован до конца на вебе — нет
 * рабочего выхода из аккаунта, реального индикатора сессии в шапке. Пока
 * это так, @Public() снят намеренно, чтобы инструмент можно было проверить
 * без входа. Модель бесплатная (Groq), риска расходов нет. Вернуть
 * требование входа, когда веб-часть E03 будет закончена.
 */
@ApiTags("ai")
@Controller("ai")
export class AiController {
  constructor(
    @Inject(ParseListingTextScenario) private readonly parseListingText: ParseListingTextScenario,
    @Inject(AI_REQUEST_LOG_REPOSITORY) private readonly requestLog: IAiRequestLogRepository,
    @Inject(MODERATION_RESULTS_REPOSITORY) private readonly moderationResults: IModerationResultsRepository,
  ) {}

  @Public()
  @Post("parse-listing-text")
  async parse(@Body() dto: ParseListingTextDto, @CurrentUser() user?: AuthUser) {
    const result = await this.parseListingText.run({ text: dto.text, actorId: user?.id });

    // Сбой сценария (E13 п. 13.27) — не HTTP-ошибка: форма остаётся пустой,
    // клиент показывает нейтральное сообщение и даёт заполнить вручную.
    if (!result.ok) {
      return { ok: false as const };
    }

    return { ok: true as const, data: result.data };
  }

  /**
   * ТЗ п.13.8 — сводка расходов за период. Настоящего интерфейса
   * админ-панели (E16) нет — это только backend, как и все admin-*
   * контроллеры в этой кодовой базе до сих пор (см. admin-moderation.controller.ts).
   */
  @UseGuards(AdminGuard)
  @Get("usage-summary")
  async usageSummary(@Query("from") from?: string, @Query("to") to?: string) {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.requestLog.getUsageSummary(fromDate, toDate);
  }

  /** ТЗ п.13.14/13.20 — очередь ручного просмотра для сценариев 1 и 2, тот же принцип "готово, но без UI". */
  @UseGuards(AdminGuard)
  @Get("moderation-queue")
  async moderationQueue() {
    return this.moderationResults.findPending();
  }
}
