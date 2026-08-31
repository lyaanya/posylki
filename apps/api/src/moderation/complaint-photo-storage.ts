export interface IComplaintPhotoStorage {
  upload(authorId: string, buffer: Buffer, contentType: string): Promise<string>;
  createSignedUrl(storagePath: string): Promise<string>;
}

export const COMPLAINT_PHOTO_STORAGE = Symbol("COMPLAINT_PHOTO_STORAGE");
