export interface IVerificationPhotoStorage {
  upload(userId: string, buffer: Buffer, contentType: string): Promise<string>;
  /** ТЗ п.16.8 — временная ссылка ограниченного срока, без возможности скачивания напрямую по постоянному URL. */
  createSignedUrl(storagePath: string): Promise<string>;
  /** ТЗ п.16.10/E04.15 — немедленное и безвозвратное удаление после решения модератора. */
  delete(storagePath: string): Promise<void>;
}

export const VERIFICATION_PHOTO_STORAGE = Symbol("VERIFICATION_PHOTO_STORAGE");
