/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePolicyResolution } from "@app/features/addPlant/hooks/usePolicyResolution";
import type { IdentificationCandidate } from "@services/id/types";
import type { SpeciesProfile } from "@core/models/speciesProfile";

const candidate: IdentificationCandidate = {
  speciesKey: "ficus-elastica",
  canonicalName: "Ficus elastica",
  commonName: "Rubber plant",
  type: "tropical",
};

const profile: SpeciesProfile = {
  speciesKey: "ficus-elastica",
  canonicalName: "Ficus elastica",
  commonName: "Rubber plant",
  type: "tropical",
  watering: "Weekly",
  lighting: "Bright indirect",
  humidity: "Medium",
  temperature: "65-80F",
  soil: "Well-draining",
  fertilizer: "Monthly",
};

describe("usePolicyResolution", () => {
  const createAsyncTracker = () => {
    let token = 0;
    return {
      startRun: vi.fn(() => {
        token += 1;
        return token;
      }),
      finishRun: vi.fn(),
      isRunStale: vi.fn((value: number) => value !== token),
    };
  };

  it("loads and caches policy results", async () => {
    const resolvePolicy = vi.fn(async () => profile);
    const onStatus = vi.fn();
    const onError = vi.fn();
    const tracker = createAsyncTracker();

    const { result } = renderHook(() =>
      usePolicyResolution({
        resolvePolicy,
        onStatus,
        onError,
        ...tracker,
      }),
    );

    await act(async () => {
      await result.current.runPolicyForCandidate(candidate);
    });

    expect(resolvePolicy).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith({ kind: "policy-loading", message: expect.any(String) });
    expect(onStatus).toHaveBeenLastCalledWith({ kind: "policy-ready", message: expect.any(String) });
    expect(result.current.selectedKey).toBe(candidate.speciesKey);
    expect(result.current.selectedProfile).toEqual(profile);

    await act(async () => {
      await result.current.runPolicyForCandidate(candidate);
    });

    expect(resolvePolicy).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenLastCalledWith({ kind: "policy-cache", message: expect.any(String) });
  });

  it("reports policy errors", async () => {
    const resolvePolicy = vi.fn(async () => {
      throw new Error("nope");
    });
    const onStatus = vi.fn();
    const onError = vi.fn();
    const tracker = createAsyncTracker();

    const { result } = renderHook(() =>
      usePolicyResolution({
        resolvePolicy,
        onStatus,
        onError,
        ...tracker,
      }),
    );

    await act(async () => {
      await result.current.runPolicyForCandidate(candidate);
    });

    expect(onError).toHaveBeenCalledWith({ type: "policy", message: "nope" });
    expect(result.current.selectedProfile).toBeNull();
  });

  it("resets cached profiles", async () => {
    const resolvePolicy = vi.fn(async () => profile);
    const onStatus = vi.fn();
    const onError = vi.fn();
    const tracker = createAsyncTracker();

    const { result } = renderHook(() =>
      usePolicyResolution({
        resolvePolicy,
        onStatus,
        onError,
        ...tracker,
      }),
    );

    await act(async () => {
      await result.current.runPolicyForCandidate(candidate);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.selectedKey).toBeNull();
    expect(result.current.selectedProfile).toBeNull();
  });
});
