import { createHash } from "node:crypto";

/**
 * ТЗ п.16.20/E04 — номер документа никогда не хранится в открытом виде и
 * не показывается сотруднику; хранится только хэш, тот же самый формат,
 * что уже сравнивает isDocumentHashBanned (E12 п.12.16). Не криптографический
 * секрет (нет соли/ключа) — единственная задача хэша здесь: узнавать
 * повторное использование того же физического документа, а не защищать
 * его от подбора.
 */
export function hashDocumentNumber(rawNumber: string): string {
  const normalized = rawNumber.trim().toUpperCase().replace(/\s+/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}
