import type { DeviceToken } from "./notifications.types.js";

export interface IDeviceTokensRepository {
  register(userId: string, platform: "ios" | "android", token: string): Promise<DeviceToken>;
  findForUser(userId: string): Promise<DeviceToken[]>;
  /** ТЗ п.14.19 — недействительный токен удаляется каналом push при доставке. */
  remove(token: string): Promise<void>;
}

export const DEVICE_TOKENS_REPOSITORY = Symbol("DEVICE_TOKENS_REPOSITORY");
