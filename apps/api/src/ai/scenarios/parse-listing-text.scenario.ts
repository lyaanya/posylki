import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { CITIES_REPOSITORY, type ICitiesRepository } from "../../directories/cities.repository.js";
import { AiService, type AiResult } from "../ai.service.js";

const parsedListingSchema = z.object({
  type: z.enum(["trip", "request"]).nullable(),
  fromCity: z.string().nullable(),
  toCity: z.string().nullable(),
  /** ISO 8601 (YYYY-MM-DD), уже разрешённая относительная дата (13.25). */
  date: z.string().nullable(),
  weightKg: z.number().nullable(),
  pricePerKg: z.number().nullable(),
  minPrice: z.number().nullable(),
  /** Имена полей, которые не удалось определить из текста (13.23). */
  undeterminedFields: z.array(z.string()),
});

export type ParsedListingText = z.infer<typeof parsedListingSchema>;

const TOOL_NAME = "submit_parsed_listing";

/**
 * Сценарий 3 (E13 пп. 13.22–13.27, задача 13.8): «лечу в Нячанг 12 августа,
 * возьму пару кило, 900 за кг» → структурированные поля объявления.
 * Результат никогда не публикуется сам — только предзаполняет форму,
 * подтверждение остаётся за человеком (13.26).
 */
@Injectable()
export class ParseListingTextScenario {
  constructor(
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(CITIES_REPOSITORY) private readonly cities: ICitiesRepository,
  ) {}

  async run(
    params: { text: string; actorId?: string | undefined },
  ): Promise<AiResult<ParsedListingText>> {
    const cities = await this.cities.findAllActive();
    const cityLines = cities
      .map((c) => `- ${c.nameRu} (${c.nameEn}); синонимы: ${c.synonyms.join(", ") || "нет"}`)
      .join("\n");

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = [
      "Ты разбираешь свободный текст объявления о попутной доставке посылок в структурированные поля.",
      `Сегодняшняя дата: ${today}. Относительные даты («завтра», «в следующую пятницу») переводи в конкретную дату ISO 8601 от этой точки отсчёта.`,
      "Город сопоставляй по названию на русском, английском или синониму из списка ниже, но в ответ всегда пиши русское название города из списка (первое в строке) — даже если в тексте город был на английском. Если упомянутый город не находится в списке — верни null для этого поля, не пытайся угадать ближайший.",
      "«Пара», «пару» в контексте веса — это 2 кг, если не указано иное.",
      "Никогда не выдумывай значения, которых нет в тексте: неопределённое поле — null, и его имя добавляется в undeterminedFields.",
      "Список городов:",
      cityLines,
    ].join("\n");

    const result = await this.aiService.runScenario<ParsedListingText>({
      scenario: "parse_listing_text",
      systemPrompt,
      userPrompt: params.text,
      toolName: TOOL_NAME,
      toolDescription: "Сохраняет разобранные поля объявления",
      toolParametersSchema: {
        type: "object",
        properties: {
          type: { type: ["string", "null"], enum: ["trip", "request", null] },
          fromCity: { type: ["string", "null"] },
          toCity: { type: ["string", "null"] },
          date: { type: ["string", "null"], description: "ISO 8601, YYYY-MM-DD" },
          weightKg: { type: ["number", "null"] },
          pricePerKg: { type: ["number", "null"] },
          minPrice: { type: ["number", "null"] },
          undeterminedFields: { type: "array", items: { type: "string" } },
        },
        required: [
          "type",
          "fromCity",
          "toCity",
          "date",
          "weightKg",
          "pricePerKg",
          "minPrice",
          "undeterminedFields",
        ],
      },
      responseSchema: parsedListingSchema,
      actorId: params.actorId,
    });

    return result;
  }
}
