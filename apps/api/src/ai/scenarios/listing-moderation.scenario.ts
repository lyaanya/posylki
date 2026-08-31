import { Injectable, Inject } from "@nestjs/common";
import { z } from "zod";
import { AiService, type AiResult } from "../ai.service.js";

const CATEGORIES = [
  "prohibited_item",
  "fraud_signs",
  "third_party_ad",
  "insults",
  "contacts_in_listing",
  "other",
] as const;

const listingModerationSchema = z.object({
  verdict: z.enum(["pass", "flag", "reject"]),
  /** null только при verdict "pass" (13.10-13.11). */
  category: z.enum(CATEGORIES).nullable(),
  /** Причина от модели — идёт в шаблон, не показывается пользователю как есть (13.12). */
  explanation: z.string().nullable(),
  /** Телефоны, ники мессенджеров, ссылки — то, что нужно вырезать из текста (13.5, 13.10). */
  contactsFound: z.array(z.string()),
});

export type ListingModerationResult = z.infer<typeof listingModerationSchema>;

const TOOL_NAME = "submit_listing_moderation";

/**
 * Сценарий 1 (E13 пп. 13.9-13.14, задача 13.4) — самое частое применение
 * ИИ в продукте: каждое объявление проходит эту проверку синхронно при
 * публикации (13.13). Политику verdict↔category задаём в промпте, а не
 * постфактум в коде: категория явно определяет серьёзность, чтобы решение
 * пользователю не казалось произвольным.
 */
@Injectable()
export class ListingModerationScenario {
  constructor(@Inject(AiService) private readonly aiService: AiService) {}

  async run(params: {
    text: string;
    fromCity: string;
    toCity: string;
    listingType: "trip" | "request";
    /** Не передаётся при публикации — сущности ещё нет на момент проверки (13.13). */
    listingId?: string | undefined;
    actorId?: string | undefined;
  }): Promise<AiResult<ListingModerationResult>> {
    const systemPrompt = [
      "Ты модерируешь текст объявления на сервисе P2P-доставки посылок между городами (попутчики берут с собой посылки других людей).",
      `Маршрут: ${params.fromCity} → ${params.toCity}. Тип объявления: ${params.listingType === "trip" ? "рейс попутчика" : "заявка на доставку"}.`,
      "Верни verdict и, если он не pass, ровно одну category:",
      "- reject + prohibited_item: упоминание запрещённого к перевозке или незаконного товара (наркотики, оружие, поддельные документы и т.п.).",
      "- reject + fraud_signs: явные признаки мошеннической схемы (просьба предоплаты вне сервиса, подозрительно нереалистичные условия).",
      "- reject + insults: оскорбления, разжигание розни.",
      "- flag + third_party_ad: реклама стороннего сервиса или канала, не относящаяся к самой доставке.",
      "- flag + contacts_in_listing: в тексте есть телефон, ник мессенджера, ссылка на профиль или другой способ связаться в обход чата сервиса — перечисли их в contactsFound как есть в тексте, дословно, чтобы их можно было вырезать.",
      "- pass: текст в порядке, category и explanation — null, contactsFound — пустой список.",
      "explanation — короткое пояснение (1 предложение) на русском, зачем нужна эта категория; не для показа пользователю в чистом виде, а как материал для шаблонного сообщения.",
      "Если сомневаешься между pass и flag — выбирай flag: он не блокирует публикацию, только отправляет на проверку человеком.",
    ].join("\n");

    return this.aiService.runScenario<ListingModerationResult>({
      scenario: "listing_moderation",
      systemPrompt,
      userPrompt: params.text,
      toolName: TOOL_NAME,
      toolDescription: "Сохраняет решение по модерации объявления",
      toolParametersSchema: {
        type: "object",
        properties: {
          verdict: { type: "string", enum: ["pass", "flag", "reject"] },
          category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
          explanation: { type: ["string", "null"] },
          contactsFound: { type: "array", items: { type: "string" } },
        },
        required: ["verdict", "category", "explanation", "contactsFound"],
      },
      responseSchema: listingModerationSchema,
      entityType: "listing",
      ...(params.listingId !== undefined ? { entityId: params.listingId } : {}),
      actorId: params.actorId,
      extractVerdict: (data) => data.verdict,
    });
  }
}
