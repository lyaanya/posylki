export interface IDealPhotoStorage {
  /** Путь складывается по сделке и загрузившему — снимать может любой участник (ТЗ п.10.27). */
  upload(dealId: string, uploaderId: string, buffer: Buffer, contentType: string): Promise<string>;
  /** ТЗ п.10.28 (тех. детали) — хранятся бессрочно, доступ по временным ссылкам. */
  createSignedUrl(storagePath: string): Promise<string>;
}

export const DEAL_PHOTO_STORAGE = Symbol("DEAL_PHOTO_STORAGE");
