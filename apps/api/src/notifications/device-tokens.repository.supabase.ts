import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { DB } from "../database/database.js";
import { DATABASE } from "../database/database.module.js";
import type { IDeviceTokensRepository } from "./device-tokens.repository.js";
import type { DeviceToken } from "./notifications.types.js";

function toDomain(row: { id: string; user_id: string; platform: "ios" | "android"; token: string }): DeviceToken {
  return { id: row.id, userId: row.user_id, platform: row.platform, token: row.token };
}

@Injectable()
export class SupabaseDeviceTokensRepository implements IDeviceTokensRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<DB>) {}

  async register(userId: string, platform: "ios" | "android", token: string): Promise<DeviceToken> {
    // Один и тот же токен переустанавливается на переустановку/переход между аккаунтами — переносим на текущего пользователя.
    const row = await this.db
      .insertInto("device_tokens")
      .values({ user_id: userId, platform, token })
      .onConflict((oc) =>
        oc.column("token").doUpdateSet({ user_id: userId, platform, last_seen_at: new Date().toISOString() }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findForUser(userId: string): Promise<DeviceToken[]> {
    const rows = await this.db.selectFrom("device_tokens").selectAll().where("user_id", "=", userId).execute();
    return rows.map(toDomain);
  }

  async remove(token: string): Promise<void> {
    await this.db.deleteFrom("device_tokens").where("token", "=", token).execute();
  }
}
