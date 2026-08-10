import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Query-параметры постраничной выдачи (E01 п. 1.20), общие для всех
 * будущих списочных эндпоинтов: GET /trips?limit=20&cursor=...
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
}

/**
 * Курсор непрозрачен для клиента: конкретную сортировочную нагрузку
 * (например { createdAt, id } для keyset-пагинации) решает репозиторий
 * каждой сущности, здесь — только кодирование/декодирование как таковое.
 */
export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor<T extends Record<string, unknown>>(cursor: string): T {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    throw new InvalidCursorError();
  }
}

export class InvalidCursorError extends Error {
  constructor() {
    super("Некорректный курсор пагинации");
  }
}

export function buildPaginatedResponse<T>(
  items: T[],
  nextCursorPayload: Record<string, unknown> | null,
): PaginatedResponse<T> {
  return {
    items,
    next_cursor: nextCursorPayload ? encodeCursor(nextCursorPayload) : null,
  };
}
