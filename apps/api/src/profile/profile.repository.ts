import type { Executor } from "../database/database.js";
import type { OwnProfile, PublicProfileView, UpdateOwnProfileInput } from "./profile.types.js";

export interface IProfileRepository {
  findPublicProfile(id: string, executor?: Executor): Promise<PublicProfileView | null>;
  findOwnProfile(id: string, executor?: Executor): Promise<OwnProfile | null>;
  updateOwnProfile(
    id: string,
    input: UpdateOwnProfileInput,
    executor?: Executor,
  ): Promise<OwnProfile>;
  /** ТЗ п.8.17 — записывается один раз, повторный вызов с другим id ничего не меняет. */
  setReferrer(id: string, referrerId: string, executor?: Executor): Promise<OwnProfile>;
  /** ТЗ п.10.37 — завершение сделки увеличивает счётчик соответствующей роли. */
  incrementDealsCount(id: string, role: "courier" | "customer", executor?: Executor): Promise<void>;
}

export const PROFILE_REPOSITORY = Symbol("PROFILE_REPOSITORY");
