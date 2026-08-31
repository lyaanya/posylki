export interface IChatAttachmentStorage {
  /**
   * Загружает файл в приватный бакет, возвращает путь (не URL). Путь
   * складывается по загрузившему, не по чату: фото первого сообщения
   * загружается раньше, чем появляется сам чат (он создаётся вместе с
   * этим сообщением — ТЗ п.9.4), поэтому chatId на этом шаге ещё нет.
   */
  upload(uploaderId: string, buffer: Buffer, contentType: string): Promise<string>;
  /** ТЗ E09 п.9.24 — временная ссылка на чтение, только для участников чата. */
  createSignedUrl(storagePath: string): Promise<string>;
}

export const CHAT_ATTACHMENT_STORAGE = Symbol("CHAT_ATTACHMENT_STORAGE");
