import { describe, expect, it } from "vitest";
import { isAdult } from "./age.js";

describe("isAdult", () => {
  const today = new Date("2026-08-31T00:00:00Z");

  it("ровно 18 лет сегодня — совершеннолетний", () => {
    expect(isAdult("2008-08-31", today)).toBe(true);
  });

  it("день рождения завтра — ещё нет 18", () => {
    expect(isAdult("2008-09-01", today)).toBe(false);
  });

  it("день рождения вчера — уже есть 18", () => {
    expect(isAdult("2008-08-30", today)).toBe(true);
  });

  it("явно младше 18", () => {
    expect(isAdult("2015-01-01", today)).toBe(false);
  });

  it("явно старше 18", () => {
    expect(isAdult("1990-01-01", today)).toBe(true);
  });
});
