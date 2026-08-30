import type { Executor } from "../database/database.js";
import type { Listing, ListingFilter, NewListing } from "./listings.types.js";

export interface IListingsRepository {
  findAll(filter: ListingFilter, executor?: Executor): Promise<Listing[]>;
  findById(id: string, executor?: Executor): Promise<Listing | null>;
  findByOwner(ownerId: string, executor?: Executor): Promise<Listing[]>;
  create(input: NewListing, executor?: Executor): Promise<Listing>;
}

export const LISTINGS_REPOSITORY = Symbol("LISTINGS_REPOSITORY");
