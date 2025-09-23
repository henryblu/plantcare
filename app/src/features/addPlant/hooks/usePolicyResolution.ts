import { useCallback, useMemo, useState } from "react";

import { buildPolicyRequest, getCacheHitStatus, getPolicyGenerationStatus, getPolicyReadyStatus } from "@app/features/addPlant/utils";
import type { IdentificationCandidate } from "@services/id/types";
import type { SpeciesProfile } from "@core/models/speciesProfile";
import type { ResolvePolicyOptions } from "@core/orchestration/cacheFlow";

import type { UiError, UiStatus } from "./types";

export interface UsePolicyResolutionOptions {
  resolvePolicy: (
    request: PolicyGenerationRequest,
    options?: ResolvePolicyOptions,
  ) => Promise<SpeciesProfile>;
  onStatus: (status: UiStatus | null) => void;
  onError: (error: UiError | null) => void;
  startRun: () => number;
  finishRun: (token: number) => void;
  isRunStale: (token: number) => boolean;
}

export interface UsePolicyResolutionResult {
  selectedKey: string | null;
  selectedProfile: SpeciesProfile | null;
  runPolicyForCandidate: (
    candidate: IdentificationCandidate | null,
    options?: ResolvePolicyOptions,
  ) => Promise<void>;
  setSelectedKey: (key: string | null) => void;
  reset: () => void;
}

export const usePolicyResolution = ({
  resolvePolicy,
  onStatus,
  onError,
  startRun,
  finishRun,
  isRunStale,
}: UsePolicyResolutionOptions): UsePolicyResolutionResult => {
  const [profiles, setProfiles] = useState<Record<string, SpeciesProfile>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProfiles({});
    setSelectedKey(null);
  }, []);

  const selectedProfile = useMemo(() => {
    if (!selectedKey) return null;
    return profiles[selectedKey] ?? null;
  }, [profiles, selectedKey]);

  const runPolicyForCandidate = useCallback(
    async (candidate: IdentificationCandidate | null, options?: ResolvePolicyOptions) => {
      if (!candidate) return;

      const cachedProfile = profiles[candidate.speciesKey];
      if (cachedProfile && !options?.forceRefresh) {
        setSelectedKey(candidate.speciesKey);
        onStatus({ kind: "policy-cache", message: getCacheHitStatus() });
        return;
      }

      const token = startRun();
      try {
        onStatus({
          kind: "policy-loading",
          message: getPolicyGenerationStatus(options?.forceRefresh),
        });
        onError(null);
        const profile = await resolvePolicy(buildPolicyRequest(candidate), options);
        if (isRunStale(token)) {
          return;
        }
        setProfiles((prev) => ({ ...prev, [candidate.speciesKey]: profile }));
        setSelectedKey(candidate.speciesKey);
        onStatus({ kind: "policy-ready", message: getPolicyReadyStatus() });
      } catch (err) {
        if (!isRunStale(token)) {
          onStatus(null);
          onError({
            type: "policy",
            message: (err as Error).message ?? "Failed to generate a care guide.",
          });
        }
      } finally {
        finishRun(token);
      }
    },
    [finishRun, isRunStale, onError, onStatus, profiles, resolvePolicy, startRun],
  );

  return {
    selectedKey,
    selectedProfile,
    runPolicyForCandidate,
    setSelectedKey,
    reset,
  };
};
