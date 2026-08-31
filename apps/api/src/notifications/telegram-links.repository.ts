import type { TelegramLink } from "./notifications.types.js";

export interface ITelegramLinksRepository {
  /** Выдаёт (или переиспользует непривязанный) одноразовый токен привязки (ТЗ п.14.3). */
  createOrReuseToken(userId: string, linkToken: string): Promise<TelegramLink>;
  findByUserId(userId: string): Promise<TelegramLink | null>;
  /** Вызывается вебхуком бота при переходе по ссылке — самого бота в этой итерации нет (см. отчёт эпика). */
  completeLink(linkToken: string, telegramChatId: string): Promise<TelegramLink | null>;
}

export const TELEGRAM_LINKS_REPOSITORY = Symbol("TELEGRAM_LINKS_REPOSITORY");
