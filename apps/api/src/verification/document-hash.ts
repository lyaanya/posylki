import { createHash } from "node:crypto";

/**
 * ТЗ E04 п.4.18 — номер документа никогда не хранится в открытом виде и не
 * показывается сотруднику; хранится только хэш с общей для инсталляции
 * солью (DOCUMENT_HASH_SALT, не попадает в репозиторий). Соль одна на всех
 * пользователей — иначе сравнение хэшей между аккаунтами (E04 п.4.5,
 * E12 п.12.16) стало бы невозможным, но без неё номер документа
 * (10-значный паспорт и т.п. — маленькое пространство значений) был бы
 * тривиально перебираем по утёкшей базе хэшей.
 */
export function hashDocumentNumber(rawNumber: string, salt: string): string {
  const normalized = rawNumber.trim().toUpperCase().replace(/\s+/g, "");
  return createHash("sha256").update(`${salt}:${normalized}`).digest("hex");
}
