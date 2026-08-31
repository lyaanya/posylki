export interface IAvatarStorage {
  /** Загружает уже обработанное изображение и возвращает публичную ссылку. */
  upload(userId: string, buffer: Buffer, contentType: string): Promise<string>;
}

export const AVATAR_STORAGE = Symbol("AVATAR_STORAGE");
