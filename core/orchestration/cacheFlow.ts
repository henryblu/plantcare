import type { PolicyGenerationRequest } from '../../services/policy/chatgpt';
import { ChatGptPolicyService } from '../../services/policy/chatgpt';
import type { SpeciesProfile } from '../models/speciesProfile';
import { PlantStore } from '../state/store';

const DEFAULT_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isFresh = (profile: SpeciesProfile, ttlMs: number, referenceMs: number): boolean => {
  const updated = Date.parse(profile.updatedAt);
  if (!Number.isFinite(updated)) return false;
  return referenceMs - updated <= ttlMs;
};

const normalizeKey = (key: string): string => key.trim().toLowerCase();

export interface SpeciesCacheFlowOptions {
  store: PlantStore;
  policyService: ChatGptPolicyService;
  ttlMs?: number;
}

export interface ResolvePolicyOptions {
  forceRefresh?: boolean;
  now?: Date;
}

export class SpeciesCacheFlow {
  private readonly store: PlantStore;
  private readonly policyService: ChatGptPolicyService;
  private readonly ttlMs: number;

  constructor(options: SpeciesCacheFlowOptions) {
    this.store = options.store;
    this.policyService = options.policyService;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  async resolve(
    request: PolicyGenerationRequest,
    options: ResolvePolicyOptions = {},
  ): Promise<SpeciesProfile> {
    const speciesKey = normalizeKey(request.speciesKey);
    const now = options.now?.getTime() ?? Date.now();
    const forceRefresh = options.forceRefresh ?? false;

    if (!forceRefresh) {
      const cached = this.store.getSpeciesProfile(speciesKey);
      if (cached && isFresh(cached, this.ttlMs, now)) {
        return cached;
      }
    }

    const profile = await this.policyService.generate({
      ...request,
      speciesKey,
    });

    const refreshedAt = new Date(now).toISOString();
    const ttlDays = Math.max(1, Math.ceil(this.ttlMs / MS_PER_DAY));
    await this.store.upsertSpeciesProfile(profile, {
      ttlDays,
      refreshedAt,
      source: profile.source,
    });
    return profile;
  }
}

export const createSpeciesCacheFlow = (options: SpeciesCacheFlowOptions): SpeciesCacheFlow =>
  new SpeciesCacheFlow(options);
