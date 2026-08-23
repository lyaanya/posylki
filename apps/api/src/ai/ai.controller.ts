import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/users.repository.js";
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
}
