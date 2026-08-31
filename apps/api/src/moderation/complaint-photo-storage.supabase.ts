import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import type { IComplaintPhotoStorage } from "./complaint-photo-storage.js";

const BUCKET = "complaint-photos";
const SIGNED_URL_TTL_SECONDS = 10 * 60;

@Injectable()
export class SupabaseComplaintPhotoStorage implements IComplaintPhotoStorage {
  private readonly client: SupabaseClient;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.client = createClient(
      config.get("SUPABASE_URL", { infer: true }),
      config.get("SUPABASE_SERVICE_KEY", { infer: true }),
    );
  }

  async upload(authorId: string, buffer: Buffer, contentType: string): Promise<string> {
    const extension = contentType === "image/png" ? "png" : "jpg";
    const path = `${authorId}/${randomUUID()}.${extension}`;
    const { error } = await this.client.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (error) {
      throw new Error(`Не удалось загрузить фото жалобы: ${error.message}`);
    }
    return path;
  }

  async createSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      throw new Error(`Не удалось выдать временную ссылку: ${error?.message}`);
    }
    return data.signedUrl;
  }
}
