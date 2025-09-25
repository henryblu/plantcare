import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PlantStore } from "@core/state/store";
import {
  createPlantFlow,
  type CreatePlantFlow,
  type CreatePlantInput,
} from "@core/orchestration/createPlantFlow";
import {
  createSpeciesCacheFlow,
  type ResolvePolicyOptions,
  type SpeciesCacheFlow,
} from "@core/orchestration/cacheFlow";
import type { Plant } from "@core/models/plant";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import { createManualCandidate, type IdentificationProvider } from "@services/id/provider";
import type {
  IdentifyRequest,
  IdentificationCandidate,
  ManualEntryInput,
} from "@services/id/types";
import type {
  ChatGptPolicyService,
  PolicyGenerationRequest,
} from "@services/policy/chatgpt";
import { createMemoryStorage } from "@services/storage/memoryAdapter";
import {
  createAsyncStorageAdapter,
  type AsyncStorageLike,
} from "@services/storage/persistentAdapter";

export interface PlantCareContextValue {
  store: PlantStore;
  hydrated: boolean;
  hydrateError: string | null;
  plantNetConfigured: boolean;
  openAiConfigured: boolean;
  identificationProvider: IdentificationProvider | null;
  policyService: ChatGptPolicyService | null;
  speciesCacheFlow: SpeciesCacheFlow | null;
  createPlantFlow: CreatePlantFlow | null;
  identify: (request: IdentifyRequest) => Promise<IdentificationCandidate[]>;
  manualCandidate: (input: ManualEntryInput) => IdentificationCandidate;
  resolvePolicy: (
    request: PolicyGenerationRequest,
    options?: ResolvePolicyOptions,
  ) => Promise<SpeciesProfile>;
  createPlant: (input: CreatePlantInput) => Promise<Plant>;
  clearStore: () => Promise<void>;
  reloadStore: () => Promise<void>;
}

const PlantCareServicesContext = createContext<PlantCareContextValue | undefined>(undefined);

export interface PlantCareProviderProps {
  children: ReactNode;
  identificationProvider: IdentificationProvider | null;
  policyService: ChatGptPolicyService | null;
  plantNetConfigured: boolean;
  openAiConfigured: boolean;
}

const adaptAsyncStorage = (candidate: unknown): AsyncStorageLike | null => {
  if (!candidate || typeof candidate !== "object") return null;
  const storage = candidate as Record<string, unknown>;
  const getItem = storage.getItem;
  const setItem = storage.setItem;
  const removeItem = storage.removeItem;
  if (
    typeof getItem !== "function" ||
    typeof setItem !== "function" ||
    typeof removeItem !== "function"
  ) {
    return null;
  }
  return {
    async getItem(key: string) {
      return Promise.resolve(getItem.call(candidate, key));
    },
    async setItem(key: string, value: string) {
      await Promise.resolve(setItem.call(candidate, key, value));
    },
    async removeItem(key: string) {
      await Promise.resolve(removeItem.call(candidate, key));
    },
  };
};

const createLocalStorageBridge = (): AsyncStorageLike | null => {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }

  const storage = window.localStorage;
  return {
    async getItem(key: string) {
      return storage.getItem(key);
    },
    async setItem(key: string, value: string) {
      storage.setItem(key, value);
    },
    async removeItem(key: string) {
      storage.removeItem(key);
    },
  };
};

const detectAsyncStorage = (): AsyncStorageLike | null => {
  const globalScope = globalThis as Record<string, unknown>;
  const candidates = [globalScope.__PLANTCARE_ASYNC_STORAGE__, globalScope.AsyncStorage];

  for (const candidate of candidates) {
    const adapted = adaptAsyncStorage(candidate);
    if (adapted) {
      return adapted;
    }
  }

  return createLocalStorageBridge();
};

const createStorageAdapter = () => {
  const asyncStorage = detectAsyncStorage();
  if (asyncStorage) {
    return createAsyncStorageAdapter(asyncStorage);
  }
  return createMemoryStorage();
};

export const PlantCareProvider = ({
  children,
  identificationProvider,
  policyService,
  plantNetConfigured,
  openAiConfigured,
}: PlantCareProviderProps) => {
  const storage = useMemo(createStorageAdapter, []);
  const store = useMemo(() => new PlantStore(storage), [storage]);

  const speciesCacheFlow = useMemo<SpeciesCacheFlow | null>(() => {
    if (!policyService) return null;
    return createSpeciesCacheFlow({
      store,
      policyService,
    });
  }, [store, policyService]);

  const createPlantFlowInstance = useMemo<CreatePlantFlow | null>(() => {
    if (!speciesCacheFlow) return null;
    return createPlantFlow({
      store,
      cacheFlow: speciesCacheFlow,
    });
  }, [store, speciesCacheFlow]);

  const [hydrated, setHydrated] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        await store.hydrate();
        if (!cancelled) {
          setHydrated(true);
          setHydrateError(null);
        }
      } catch (error) {
        console.error("[PlantCareProvider] Failed to hydrate store", error);
        if (!cancelled) {
          setHydrated(true);
          setHydrateError((error as Error).message ?? "Failed to hydrate store");
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [store]);

  const identify = useCallback(
    async (request: IdentifyRequest): Promise<IdentificationCandidate[]> => {
      if (!identificationProvider) {
        throw new Error("Identification provider is not configured.");
      }
      return identificationProvider.identify(request);
    },
    [identificationProvider],
  );

  const manualCandidate = useCallback(
    (input: ManualEntryInput): IdentificationCandidate => {
      if (identificationProvider) {
        return identificationProvider.manualEntry(input);
      }
      return createManualCandidate(input);
    },
    [identificationProvider],
  );

  const resolvePolicy = useCallback(
    async (
      request: PolicyGenerationRequest,
      options?: ResolvePolicyOptions,
    ): Promise<SpeciesProfile> => {
      if (speciesCacheFlow) {
        return speciesCacheFlow.resolve(request, options);
      }
      if (!policyService) {
        throw new Error("Policy service is not configured.");
      }
      return policyService.generate(request);
    },
    [speciesCacheFlow, policyService],
  );

  const createPlantHandler = useCallback(
    async (input: CreatePlantInput): Promise<Plant> => {
      if (!createPlantFlowInstance) {
        throw new Error("Create plant flow is not available.");
      }
      return createPlantFlowInstance.execute(input);
    },
    [createPlantFlowInstance],
  );

  const clearStore = useCallback(async () => {
    await store.clear();
    setHydrated(true);
    setHydrateError(null);
  }, [store]);

  const reloadStore = useCallback(async () => {
    await store.hydrate();
    setHydrated(true);
    setHydrateError(null);
  }, [store]);

  const value = useMemo<PlantCareContextValue>(
    () => ({
      store,
      hydrated,
      hydrateError,
      plantNetConfigured,
      openAiConfigured,
      identificationProvider,
      policyService,
      speciesCacheFlow,
      createPlantFlow: createPlantFlowInstance,
      identify,
      manualCandidate,
      resolvePolicy,
      createPlant: createPlantHandler,
      clearStore,
      reloadStore,
    }),
    [
      store,
      hydrated,
      hydrateError,
      plantNetConfigured,
      openAiConfigured,
      identificationProvider,
      policyService,
      speciesCacheFlow,
      createPlantFlowInstance,
      identify,
      manualCandidate,
      resolvePolicy,
      createPlantHandler,
      clearStore,
      reloadStore,
    ],
  );

  return (
    <PlantCareServicesContext.Provider value={value}>
      {children}
    </PlantCareServicesContext.Provider>
  );
};

export const usePlantCareServices = (): PlantCareContextValue => {
  const context = useContext(PlantCareServicesContext);
  if (!context) {
    throw new Error("usePlantCareServices must be used within a PlantCareProvider.");
  }
  return context;
};

