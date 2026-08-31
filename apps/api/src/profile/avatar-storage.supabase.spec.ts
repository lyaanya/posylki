import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../config/env.js";
import { SupabaseAvatarStorage } from "./avatar-storage.supabase.js";

// 1x1 белый пиксель JPEG — минимальный валидный файл для проверки самой
// загрузки в Storage, без интереса к содержимому изображения.
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64",
);

describe("SupabaseAvatarStorage", () => {
  let storage: SupabaseAvatarStorage;
  let supabase: ReturnType<typeof createClient>;
  const testUserId = "00000000-0000-0000-0000-00000000ffff";

  beforeAll(() => {
    const env = {
      SUPABASE_URL: process.env["SUPABASE_URL"] ?? "",
      SUPABASE_SERVICE_KEY: process.env["SUPABASE_SERVICE_KEY"] ?? "",
    };
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY не заданы — см. .env.example");
    }

    const config = {
      get: (key: keyof Env) => (env as Record<string, string>)[key],
    } as unknown as ConfigService<Env, true>;

    storage = new SupabaseAvatarStorage(config);
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  });

  afterAll(async () => {
    await supabase.storage.from("avatars").remove([`${testUserId}.jpg`]);
  });

  it("загружает файл в публичный бакет и отдаёт рабочую публичную ссылку", async () => {
    const url = await storage.upload(testUserId, TINY_JPEG, "image/jpeg");

    expect(url).toContain(`/avatars/${testUserId}.jpg`);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
  });

  it("повторная загрузка перезаписывает файл по тому же пути (upsert)", async () => {
    await storage.upload(testUserId, TINY_JPEG, "image/jpeg");
    const secondUrl = await storage.upload(testUserId, TINY_JPEG, "image/jpeg");

    const { data } = await supabase.storage.from("avatars").list("", { search: testUserId });
    const matches = data?.filter((f) => f.name.startsWith(testUserId)) ?? [];
    expect(matches).toHaveLength(1);

    const response = await fetch(secondUrl);
    expect(response.status).toBe(200);
  });
});
