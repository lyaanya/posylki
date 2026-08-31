import { describe, expect, it } from "vitest";
import { computeSendAfter, isQuietHours, resolveTimezone } from "./quiet-hours.js";

describe("resolveTimezone", () => {
  it("использует часовой пояс города, если он есть", () => {
    expect(resolveTimezone("Asia/Ho_Chi_Minh")).toBe("Asia/Ho_Chi_Minh");
  });

  it("падает на Europe/Moscow при отсутствии города (ТЗ п.14.11)", () => {
    expect(resolveTimezone(null)).toBe("Europe/Moscow");
    expect(resolveTimezone(undefined)).toBe("Europe/Moscow");
  });
});

describe("isQuietHours", () => {
  it("02:00 по Москве — тихие часы", () => {
    // 2026-01-15T02:00:00 Europe/Moscow (UTC+3) = 2026-01-14T23:00:00Z
    expect(isQuietHours(new Date("2026-01-14T23:00:00Z"), "Europe/Moscow")).toBe(true);
  });

  it("14:00 по Москве — не тихие часы", () => {
    expect(isQuietHours(new Date("2026-01-14T11:00:00Z"), "Europe/Moscow")).toBe(false);
  });

  it("ровно 23:00 — уже тихие часы, 07:59 — ещё тихие часы, 08:00 — уже нет", () => {
    expect(isQuietHours(new Date("2026-01-14T23:00:00+03:00"), "Europe/Moscow")).toBe(true);
    expect(isQuietHours(new Date("2026-01-15T07:59:00+03:00"), "Europe/Moscow")).toBe(true);
    expect(isQuietHours(new Date("2026-01-15T08:00:00+03:00"), "Europe/Moscow")).toBe(false);
  });
});

describe("computeSendAfter", () => {
  it("срочное уведомление в 02:00 доставляется немедленно (критерий приёмки)", () => {
    const now = new Date("2026-01-14T23:00:00Z"); // 02:00 MSK
    expect(computeSendAfter(now, "Europe/Moscow", true)).toEqual(now);
  });

  it("несрочное уведомление в 02:00 откладывается до 08:00 по местному времени (критерий приёмки)", () => {
    const now = new Date("2026-01-14T23:00:00Z"); // 2026-01-15 02:00 MSK
    const result = computeSendAfter(now, "Europe/Moscow", false);
    // 08:00 MSK 2026-01-15 = 05:00Z
    expect(result.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });

  it("несрочное уведомление в 23:30 откладывается на завтрашние 08:00", () => {
    const now = new Date("2026-01-14T20:30:00Z"); // 23:30 MSK 14 января
    const result = computeSendAfter(now, "Europe/Moscow", false);
    // 08:00 MSK 15 января = 05:00Z 15 января
    expect(result.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });

  it("несрочное уведомление днём отправляется сразу", () => {
    const now = new Date("2026-01-14T11:00:00Z"); // 14:00 MSK
    expect(computeSendAfter(now, "Europe/Moscow", false)).toEqual(now);
  });

  it("разница часовых поясов Москва/Нячанг учитывается (ТЗ, обоснование эпика)", () => {
    // 23:30 в Нячанге (Asia/Ho_Chi_Minh, UTC+7) — тихие часы там, хотя в Москве ещё день.
    const now = new Date("2026-01-14T16:30:00Z"); // 23:30 в Нячанге
    expect(isQuietHours(now, "Asia/Ho_Chi_Minh")).toBe(true);
    expect(isQuietHours(now, "Europe/Moscow")).toBe(false);
  });
});
