import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../config/env.js";
import { AiService } from "./ai.service.js";
import type { IAiRequestLogRepository } from "./ai-request-log.repository.js";

function makeConfig(apiKey: string | undefined) {
  return {
    get: (key: string) => (key === "GROQ_API_KEY" ? apiKey : "openai/gpt-oss-120b"),
  } as unknown as ConfigService<Env, true>;
}

describe("AiService", () => {
  it("без ключа не роняет продукт — возвращает сбой и пишет его в лог (E13 п. 13.6)", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const requestLog: IAiRequestLogRepository = { create, getUsageSummary: vi.fn() };

    const service = new AiService(makeConfig(undefined), requestLog);

    const result = await service.runScenario({
      scenario: "parse_listing_text",
      systemPrompt: "system",
      userPrompt: "лечу в Нячанг",
      toolName: "submit",
      toolDescription: "d",
      toolParametersSchema: { type: "object", properties: {}, required: [] },
      responseSchema: z.object({}),
    });

    expect(result.ok).toBe(false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ scenario: "parse_listing_text", isError: true }),
    );
  });

  it("не падает, если сам лог не пишется — результат сценария важнее", async () => {
    const requestLog: IAiRequestLogRepository = {
      create: vi.fn().mockRejectedValue(new Error("db down")),
      getUsageSummary: vi.fn(),
    };

    const service = new AiService(makeConfig(undefined), requestLog);

    await expect(
      service.runScenario({
        scenario: "parse_listing_text",
        systemPrompt: "system",
        userPrompt: "текст",
        toolName: "submit",
        toolDescription: "d",
        toolParametersSchema: { type: "object", properties: {}, required: [] },
        responseSchema: z.object({}),
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});
