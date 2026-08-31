import { describe, expect, it } from "vitest";
import { nextRetryDelayMs } from "./retry-backoff.js";

describe("nextRetryDelayMs", () => {
  it("нарастающий интервал на первых трёх попытках", () => {
    expect(nextRetryDelayMs(0)).toBe(60_000);
    expect(nextRetryDelayMs(1)).toBe(120_000);
    expect(nextRetryDelayMs(2)).toBe(240_000);
  });

  it("после трёх попыток — null, повторов больше нет", () => {
    expect(nextRetryDelayMs(3)).toBeNull();
    expect(nextRetryDelayMs(10)).toBeNull();
  });
});
