import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import type { IAvatarStorage } from "./avatar-storage.js";

const BUCKET = "avatars";

/**
 * E06 п. 6.12/6.2: фотографии профиля лежат в публичном бакете Storage —
 * доступ к нему нужен только Storage API (не Postgres/Kysely), поэтому
 * это единственное место в проекте, где мы создаём клиент supabase-js
 * (на service-ключе, в обход RLS — как и остальной бэкенд).
 */
@Injectable()
export class SupabaseAvatarStorage implements IAvatarStorage {
  private readonly client: SupabaseClient;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.client = createClient(
      config.get("SUPABASE_URL", { infer: true }),
      config.get("SUPABASE_SERVICE_KEY", { infer: true }),
    );
  }

  async upload(userId: string, buffer: Buffer, contentType: string): Promise<string> {
    const extension = contentType === "image/png" ? "png" : "jpg";
    // Один и тот же путь на пользователя (upsert) — иначе при каждой смене
    // фото в бакете копился бы мусор из старых версий.
    const path = `${userId}.${extension}`;

    const { error } = await this.client.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Не удалось загрузить фото профиля: ${error.message}`);
    }

    const { data } = this.client.storage.from(BUCKET).getPublicUrl(path);
    // Публичный URL от Supabase не меняется между загрузками на один путь,
    // поэтому добавляем метку времени, чтобы кеш браузера не показывал старое фото.
    return `${data.publicUrl}?v=${Date.now()}`;
  }
}
