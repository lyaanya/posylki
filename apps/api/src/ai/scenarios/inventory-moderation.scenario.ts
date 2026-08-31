import { Injectable, Inject } from "@nestjs/common";
import { z } from "zod";
import { AiService, type AiResult } from "../ai.service.js";

const itemWarningSchema = z.object({
  /** null, если пункт не вызывает опасений (13.18) — предупреждение, не запрет: тот идёт из стоп-листа в коде. */
  warning: z.string().nullable(),
});

export type ItemWarningResult = z.infer<typeof itemWarningSchema>;

const TOOL_NAME = "submit_item_warning";

/**
 * Сценарий 2 (E13 пп. 13.15-13.21, задача 13.6), уровень "предупреждение":
 * жёсткий запрет по стоп-листу (E05) проверяется в коде ДО вызова этого
 * сценария (deals.controller.ts) — сюда попадают только позиции, которые
 * уже прошли этот фильтр. Модель оценивает только законодательство страны
 * назначения, своим знанием, не как юридический источник (13.18).
 */
@Injectable()
export class InventoryModerationScenario {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  async run(params: {
    itemName: string;
    destinationCountryCode: string;
    dealId: string;
    actorId?: string | undefined;
  }): Promise<AiResult<ItemWarningResult>> {
    const systemPrompt = [
      "Ты проверяешь одну позицию описи посылки на предмет предупреждений по законодательству страны назначения.",
      `Код страны назначения (ISO 3166-1 alpha-2): ${params.destinationCountryCode}.`,
      "Если провоз этого предмета может быть ограничен, требовать декларации или разрешения в этой стране — сформулируй короткое предупреждение как повод проверить перед вылетом, а не как приговор. Пример тона: «в этой стране препарат может быть в списке контролируемых, уточните перед вылетом».",
      "Ты не юридический источник — не утверждай категорично, не выдумывай статьи закона.",
      "Если предмет обычный и не вызывает опасений — верни null.",
    ].join("\n");

    return this.aiService.runScenario<ItemWarningResult>({
      scenario: "inventory_moderation",
      systemPrompt,
      userPrompt: params.itemName,
      toolName: TOOL_NAME,
      toolDescription: "Сохраняет предупреждение по позиции описи (или null)",
      toolParametersSchema: {
        type: "object",
        properties: {
          warning: { type: ["string", "null"] },
        },
        required: ["warning"],
      },
      responseSchema: itemWarningSchema,
      entityType: "deal",
      entityId: params.dealId,
      actorId: params.actorId,
      extractVerdict: (data) => (data.warning ? "warned" : "pass"),
    });
  }
}
