import type { Executor } from "../database/database.js";
import type { ListingMatchCandidate, NewRouteSubscription, RouteSubscription } from "./subscriptions.types.js";

export interface ISubscriptionsRepository {
  findByUser(userId: string, executor?: Executor): Promise<RouteSubscription[]>;
  countByUser(userId: string, executor?: Executor): Promise<number>;
  create(input: NewRouteSubscription, executor?: Executor): Promise<RouteSubscription>;
  findOwned(id: string, userId: string, executor?: Executor): Promise<RouteSubscription | null>;
  setActive(id: string, isActive: boolean, executor?: Executor): Promise<RouteSubscription>;
  delete(id: string, executor?: Executor): Promise<void>;
  /**
   * ТЗ, техдетали эпика: совпадение считается при публикации объявления,
   * а не периодическим обходом всех подписок. Записывает совпадения в
   * subscription_matches; сама отправка уведомлений — E14, здесь не входит.
   */
  recordMatches(listing: ListingMatchCandidate, executor?: Executor): Promise<number>;
}

export const SUBSCRIPTIONS_REPOSITORY = Symbol("SUBSCRIPTIONS_REPOSITORY");
