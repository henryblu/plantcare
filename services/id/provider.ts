import { PlantNetClient } from './plantNet';
import type {
  IdentifyRequest,
  IdentificationCandidate,
  ManualEntryInput,
} from './types';
import { normalizeSpeciesKey } from './types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_MOCK_CANDIDATES: IdentificationCandidate[] = [
  {
    speciesKey: normalizeSpeciesKey('Epipremnum aureum', '39994'),
    canonicalName: 'Epipremnum aureum',
    commonName: 'Golden pothos',
    taxonId: '39994',
    score: 0.92,
    source: 'mock',
  },
  {
    speciesKey: normalizeSpeciesKey('Monstera deliciosa', '2877891'),
    canonicalName: 'Monstera deliciosa',
    commonName: 'Swiss cheese plant',
    taxonId: '2877891',
    score: 0.81,
    source: 'mock',
  },
];

export interface IdentificationProviderOptions {
  plantNetClient?: PlantNetClient;
  useMocks?: boolean;
  mockDelayMs?: number;
  mockCandidates?: IdentificationCandidate[];
}

export interface IdentificationProvider {
  identify(request: IdentifyRequest): Promise<IdentificationCandidate[]>;
  manualEntry(input: ManualEntryInput): IdentificationCandidate;
}

const cloneCandidate = (candidate: IdentificationCandidate): IdentificationCandidate => ({
  ...candidate,
});

const normalizeMockCandidates = (
  candidates: IdentificationCandidate[],
): IdentificationCandidate[] =>
  candidates.map((candidate) => ({
    ...candidate,
    speciesKey: normalizeSpeciesKey(candidate.canonicalName, candidate.taxonId),
    source: 'mock',
  }));

export const createManualCandidate = (input: ManualEntryInput): IdentificationCandidate => {
  const canonicalName = input.canonicalName.trim();
  if (!canonicalName) {
    throw new Error('Manual entry requires a canonical species name.');
  }

  const speciesKey = normalizeSpeciesKey(canonicalName);
  return {
    speciesKey,
    canonicalName,
    commonName: input.commonName?.trim() || undefined,
    taxonId: undefined,
    score: 1,
    type: input.type,
    source: 'manual',
  };
};

export const createIdentificationProvider = (
  options: IdentificationProviderOptions = {},
): IdentificationProvider => {
  const useMocks = options.useMocks ?? !options.plantNetClient;
  const mockResults = normalizeMockCandidates(options.mockCandidates ?? DEFAULT_MOCK_CANDIDATES);

  const identifyWithMocks = async (request: IdentifyRequest): Promise<IdentificationCandidate[]> => {
    if (options.mockDelayMs && options.mockDelayMs > 0) {
      await delay(options.mockDelayMs);
    }
    const limit = request.limit ?? mockResults.length;
    return normalizeMockCandidates(mockResults)
      .slice(0, limit)
      .map(cloneCandidate);
  };

  const identifyWithPlantNet = async (request: IdentifyRequest): Promise<IdentificationCandidate[]> => {
    if (!options.plantNetClient) {
      throw new Error('PlantNet client is not configured.');
    }
    const results = await options.plantNetClient.identify(request);
    const limit = request.limit;
    const limited = limit && limit > 0 ? results.slice(0, limit) : results;
    return limited.map(cloneCandidate);
  };

  return {
    async identify(request: IdentifyRequest) {
      if (useMocks) {
        return identifyWithMocks(request);
      }
      return identifyWithPlantNet(request);
    },
    manualEntry: createManualCandidate,
  };
};