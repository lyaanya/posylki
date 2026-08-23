import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Groq from "groq-sdk";
import type { z } from "zod";
import type { Env } from "../config/env.js";
import { AI_REQUEST_LOG_REPOSITORY, type IAiRequestLogRepository } from "./ai-request-log.repository.js";
import type { AiScenario } from "./ai.types.js";

const TIMEOUT_MS = 10_000;

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface AiToolCallParams<T> {
  scenario: AiScenario;
  systemPrompt: string;
  userPrompt: string;
  /** Единственная функция, вызов которой модель обязана сделать — так ответ приходит структурированным (E13 п. 13.4), а не текстом для парсинга. */
  toolName: string;
  toolDescription: string;
  toolParametersSchema: Record<string, unknown>;
  /** Валидирует аргументы вызванной функции; несовпадение — сбой, не результат (13.4). */
  responseSchema: z.ZodType<T>;
  entityType?: string;
  entityId?: string;
  actorId?: string | undefined;
  /** Вычисляет короткий вердикт для лога (13.7) — например "pass"/"flag"/"reject". Не обязателен. */
  extractVerdict?: (data: T) => string | null;
}

/**
 * Единая точка входа ко всем вызовам языковой модели (E13 п. 13.1) — другие
 * модули не обращаются к Groq API напрямую. Каждый сценарий описывает свой
 * промпт и схему функции и вызывает runScenario.
 *
 * Модель — бесплатная gpt-oss-120b (OpenAI, открытые веса) через Groq, а не
 * платный API OpenAI: тот же принцип единой точки входа и структурированного
 * ответа, но без затрат на этапе обкатки. Смена модели — переменная
 * окружения GROQ_MODEL, без правки кода (13.2).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(AI_REQUEST_LOG_REPOSITORY) private readonly requestLog: IAiRequestLogRepository,
  ) {
    this.apiKey = config.get("GROQ_API_KEY", { infer: true });
    this.model = config.get("GROQ_MODEL", { infer: true });
  }

  async runScenario<T>(params: AiToolCallParams<T>): Promise<AiResult<T>> {
    const startedAt = Date.now();

    // Недоступность ИИ-сервиса никогда не должна останавливать продукт
    // (E13 п. 13.6) — отсутствие ключа обрабатывается как сбой сценария,
    // а не падение приложения.
    if (!this.apiKey) {
      const error = "GROQ_API_KEY не задан";
      await this.log(params, startedAt, { isError: true, errorMessage: error });
      return { ok: false, error };
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const client = new Groq({ apiKey: this.apiKey, timeout: TIMEOUT_MS });

        const response = await client.chat.completions.create({
          model: this.model,
          max_completion_tokens: 1024,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: params.toolName,
                description: params.toolDescription,
                parameters: params.toolParametersSchema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: params.toolName } },
        });

        const toolCall = response.choices[0]?.message.tool_calls?.[0];

        if (!toolCall) {
          throw new Error("Модель не вызвала обязательную функцию");
        }

        const rawArguments: unknown = JSON.parse(toolCall.function.arguments);
        const parsed = params.responseSchema.parse(rawArguments);

        await this.log(params, startedAt, {
          isError: false,
          responseLength: toolCall.function.arguments.length,
          verdict: params.extractVerdict?.(parsed) ?? null,
          inputTokens: response.usage?.prompt_tokens,
          outputTokens: response.usage?.completion_tokens,
        });

        return { ok: true, data: parsed };
      } catch (error) {
        lastError = error;
        this.logger.warn(`Сценарий ${params.scenario}, попытка ${attempt + 1}: ${String(error)}`);
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    await this.log(params, startedAt, { isError: true, errorMessage: message });
    return { ok: false, error: message };
  }

  private async log<T>(
    params: AiToolCallParams<T>,
    startedAt: number,
    outcome: {
      isError: boolean;
      errorMessage?: string | undefined;
      responseLength?: number | undefined;
      verdict?: string | null | undefined;
      inputTokens?: number | undefined;
      outputTokens?: number | undefined;
    },
  ): Promise<void> {
    try {
      await this.requestLog.create({
        scenario: params.scenario,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        actorId: params.actorId ?? null,
        requestLength: params.userPrompt.length,
        responseLength: outcome.responseLength ?? null,
        verdict: outcome.verdict ?? null,
        durationMs: Date.now() - startedAt,
        inputTokens: outcome.inputTokens ?? null,
        outputTokens: outcome.outputTokens ?? null,
        isError: outcome.isError,
        errorMessage: outcome.errorMessage ?? null,
      });
    } catch (logError) {
      // Сбой логирования не должен маскировать реальный результат сценария.
      this.logger.error(`Не удалось записать ai_requests: ${String(logError)}`);
    }
  }
}
