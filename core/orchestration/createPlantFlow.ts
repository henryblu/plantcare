import type { PolicyGenerationRequest } from "../../services/policy/chatgpt";
import type { MoisturePolicy } from "../models/moisturePolicy";
import type { Plant } from "../models/plant";
import { PlantStore } from "../state/store";
import { SpeciesCacheFlow } from "./cacheFlow";

const defaultIdFactory = (): string => {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `plant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toIsoString = (value?: string | number | Date): string => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
};

export interface PlantDraft {
  id?: string;
  nickname?: string;
  location?: string;
  photoUri?: string;
  lastWateredAt?: string;
  notes?: string;
  moisturePolicyOverride?: MoisturePolicy;
}

export interface CreatePlantInput {
  species: PolicyGenerationRequest;
  plant: PlantDraft;
  forcePolicyRefresh?: boolean;
  timestamps?: {
    createdAt?: string | number | Date;
    updatedAt?: string | number | Date;
  };
}

export interface CreatePlantFlowOptions {
  store: PlantStore;
  cacheFlow: SpeciesCacheFlow;
  idFactory?: () => string;
}

export class CreatePlantFlow {
  private readonly store: PlantStore;
  private readonly cacheFlow: SpeciesCacheFlow;
  private readonly idFactory: () => string;

  constructor(options: CreatePlantFlowOptions) {
    this.store = options.store;
    this.cacheFlow = options.cacheFlow;
    this.idFactory = options.idFactory ?? defaultIdFactory;
  }

  async execute(input: CreatePlantInput): Promise<Plant> {
    const speciesProfile = await this.cacheFlow.resolve(input.species, {
      forceRefresh: input.forcePolicyRefresh,
    });

    const id = input.plant.id?.trim() || this.idFactory();
    const createdAt = toIsoString(input.timestamps?.createdAt);
    const updatedAt = toIsoString(input.timestamps?.updatedAt ?? Date.now());

    const plant: Plant = {
      id,
      speciesKey: speciesProfile.speciesKey,
      nickname: input.plant.nickname,
      location: input.plant.location,
      photoUri: input.plant.photoUri,
      createdAt,
      updatedAt,
      lastWateredAt: input.plant.lastWateredAt,
      notes: input.plant.notes,
      moisturePolicyOverride: input.plant.moisturePolicyOverride,
      speciesProfile,
    };

    await this.store.upsertPlant(plant);
    return this.store.getPlant(id) ?? plant;
  }
}

export const createPlantFlow = (options: CreatePlantFlowOptions): CreatePlantFlow =>
  new CreatePlantFlow(options);


