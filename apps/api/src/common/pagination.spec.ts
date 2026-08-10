import { describe, expect, it } from "vitest";
import {
  buildPaginatedResponse,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
} from "./pagination.js";

describe("пагинация", () => {
  it("encodeCursor/decodeCursor восстанавливают исходную нагрузку", () => {
    const payload = { createdAt: "2026-08-01T00:00:00.000Z", id: "abc-123" };
    const cursor = encodeCursor(payload);

    expect(typeof cursor).toBe("string");
    expect(decodeCursor(cursor)).toEqual(payload);
  });

  it("decodeCursor бросает InvalidCursorError на мусорном вводе", () => {
    expect(() => decodeCursor("не-курсор-совсем")).toThrow(InvalidCursorError);
  });

  it("buildPaginatedResponse отдаёт next_cursor: null, когда следующей страницы нет", () => {
    const response = buildPaginatedResponse([1, 2, 3], null);

    expect(response).toEqual({ items: [1, 2, 3], next_cursor: null });
  });

  it("buildPaginatedResponse кодирует курсор, когда следующая страница есть", () => {
    const response = buildPaginatedResponse(["a"], { id: "next-id" });

    expect(response.next_cursor).not.toBeNull();
    expect(decodeCursor(response.next_cursor as string)).toEqual({ id: "next-id" });
  });
});
