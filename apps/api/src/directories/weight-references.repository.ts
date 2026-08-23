import type { Executor } from "../database/database.js";
import type { NewWeightReference, UpdateWeightReference, WeightReference } from "./directories.types.js";

export interface IWeightReferencesRepository {
  findAllActive(executor?: Executor): Promise<WeightReference[]>;
  findById(id: string, executor?: Executor): Promise<WeightReference | null>;
  create(input: NewWeightReference, executor?: Executor): Promise<WeightReference>;
  update(
    id: string,
    input: UpdateWeightReference,
    executor?: Executor,
  ): Promise<WeightReference | null>;
  setActive(id: string, isActive: boolean, executor?: Executor): Promise<WeightReference | null>;
}

export const WEIGHT_REFERENCES_REPOSITORY = Symbol("WEIGHT_REFERENCES_REPOSITORY");
