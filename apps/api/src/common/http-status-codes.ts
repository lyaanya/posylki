import { HttpStatus } from "@nestjs/common";

/**
 * Запасной machine-readable code, когда исключение не наше AppException
 * (например 404 от роутера Nest на несуществующем пути). Для реальных
 * бизнес-ошибок контроллеры бросают AppException с конкретным code.
 */
const FALLBACK_CODES: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
  [HttpStatus.UNAUTHORIZED]: "AUTH_REQUIRED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "VALIDATION_ERROR",
  [HttpStatus.TOO_MANY_REQUESTS]: "TOO_MANY_REQUESTS",
  [HttpStatus.INTERNAL_SERVER_ERROR]: "INTERNAL_ERROR",
};

export function fallbackCodeFor(status: number): string {
  return FALLBACK_CODES[status as HttpStatus] ?? "UNKNOWN_ERROR";
}
