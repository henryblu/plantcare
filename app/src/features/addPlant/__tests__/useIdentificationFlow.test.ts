/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useIdentificationFlow } from "@app/features/addPlant/hooks/useIdentificationFlow";
import type { PreparedImageFile } from "@app/utils/imageProcessing";
import type { IdentificationCandidate } from "@services/id/types";

const images: PreparedImageFile[] = [
  {
    file: new File(["primary"], "primary.jpg", { type: "image/jpeg" }),
    width: 800,
    height: 600,
    originalWidth: 1024,
    originalHeight: 768,
    wasDownscaled: false,
  },
];

const highConfidenceCandidates: IdentificationCandidate[] = [
  {
    speciesKey: "monstera-deliciosa",
    canonicalName: "Monstera deliciosa",
    commonName: "Swiss cheese plant",
    score: 0.92,
    type: "tropical",
  },
  {
    speciesKey: "monstera-adansonii",
    canonicalName: "Monstera adansonii",
    commonName: "Adanson's monstera",
    score: 0.35,
    type: "tropical",
  },
];

const lowConfidenceCandidates: IdentificationCandidate[] = [
  {
    speciesKey: "pilea-peperomioides",
    canonicalName: "Pilea peperomioides",
    commonName: "Chinese money plant",
    score: 0.2,
    type: "tropical",
  },
  {
    speciesKey: "pilea-cadierei",
    canonicalName: "Pilea cadierei",
    commonName: "Aluminum plant",
    score: 0.18,
    type: "tropical",
  },
];

describe("useIdentificationFlow", () => {
  const createTracker = () => {
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

  const baseOptions = () => {
    const onStatus = vi.fn();
    const onError = vi.fn();
    const onManualModeChange = vi.fn();
    const tracker = createTracker();
    const runPolicyForCandidate = vi.fn(async () => {});
    const setSelectedKey = vi.fn();
    const prepared = [...images];

    return {
      onStatus,
      onError,
      onManualModeChange,
      runPolicyForCandidate,
      setSelectedKey,
      tracker,
      getPreparedImages: () => prepared,
      prepared,
    };
  };

  it("runs policy when confidence is sufficient", async () => {
    const options = baseOptions();
    const identify = vi.fn(async () => highConfidenceCandidates);

    const { result } = renderHook(() =>
      useIdentificationFlow({
        identify,
        plantNetConfigured: true,
        maxPhotos: 3,
        getPreparedImages: options.getPreparedImages,
        onReset: vi.fn(),
        onStatus: options.onStatus,
        onError: options.onError,
        onManualModeChange: options.onManualModeChange,
        runPolicyForCandidate: options.runPolicyForCandidate,
        setSelectedKey: options.setSelectedKey,
        startRun: options.tracker.startRun,
        finishRun: options.tracker.finishRun,
        isRunStale: options.tracker.isRunStale,
      }),
    );

    await act(async () => {
      await result.current.identifyWithImages(images);
    });

    expect(result.current.candidates).toHaveLength(2);
    expect(result.current.confidence?.level).toBe("high");
    expect(options.runPolicyForCandidate).toHaveBeenCalledWith(highConfidenceCandidates[0]);
    expect(options.onManualModeChange).toHaveBeenCalledWith(false);
  });

  it("flags low confidence without running policy", async () => {
    const options = baseOptions();
    const identify = vi.fn(async () => lowConfidenceCandidates);

    const { result } = renderHook(() =>
      useIdentificationFlow({
        identify,
        plantNetConfigured: true,
        maxPhotos: 3,
        getPreparedImages: options.getPreparedImages,
        onReset: vi.fn(),
        onStatus: options.onStatus,
        onError: options.onError,
        onManualModeChange: options.onManualModeChange,
        runPolicyForCandidate: options.runPolicyForCandidate,
        setSelectedKey: options.setSelectedKey,
        startRun: options.tracker.startRun,
        finishRun: options.tracker.finishRun,
        isRunStale: options.tracker.isRunStale,
      }),
    );

    await act(async () => {
      await result.current.identifyWithImages(images);
    });

    expect(result.current.confidence?.level).toBe("low");
    expect(result.current.manualRecommended).toBe(false);
    expect(options.runPolicyForCandidate).not.toHaveBeenCalled();
    expect(options.onStatus).toHaveBeenLastCalledWith({ kind: "confidence-low", message: expect.any(String) });
  });

  it("recommends manual entry when low confidence hits photo limit", async () => {
    const options = baseOptions();
    const identify = vi.fn(async () => lowConfidenceCandidates);
    const prepared = [...images, { ...images[0], file: new File(["extra"], "extra.jpg") }];

    const { result } = renderHook(() =>
      useIdentificationFlow({
        identify,
        plantNetConfigured: true,
        maxPhotos: 2,
        getPreparedImages: () => prepared,
        onReset: vi.fn(),
        onStatus: options.onStatus,
        onError: options.onError,
        onManualModeChange: options.onManualModeChange,
        runPolicyForCandidate: options.runPolicyForCandidate,
        setSelectedKey: options.setSelectedKey,
        startRun: options.tracker.startRun,
        finishRun: options.tracker.finishRun,
        isRunStale: options.tracker.isRunStale,
      }),
    );

    await act(async () => {
      await result.current.identifyWithImages(prepared);
    });

    expect(result.current.manualRecommended).toBe(true);
    expect(options.onManualModeChange).toHaveBeenCalledWith(true);
  });

  it("prevents selecting low-confidence candidates without more photos", async () => {
    const options = baseOptions();
    const identify = vi.fn(async () => lowConfidenceCandidates);

    const { result } = renderHook(() =>
      useIdentificationFlow({
        identify,
        plantNetConfigured: true,
        maxPhotos: 3,
        getPreparedImages: options.getPreparedImages,
        onReset: vi.fn(),
        onStatus: options.onStatus,
        onError: options.onError,
        onManualModeChange: options.onManualModeChange,
        runPolicyForCandidate: options.runPolicyForCandidate,
        setSelectedKey: options.setSelectedKey,
        startRun: options.tracker.startRun,
        finishRun: options.tracker.finishRun,
        isRunStale: options.tracker.isRunStale,
      }),
    );

    await act(async () => {
      await result.current.identifyWithImages(images);
    });

    await act(async () => {
      await result.current.handleSelectCandidate(lowConfidenceCandidates[0].speciesKey);
    });

    expect(options.runPolicyForCandidate).not.toHaveBeenCalled();
    expect(options.onStatus).toHaveBeenLastCalledWith({ kind: "confidence-low", message: expect.any(String) });
  });

  it("handles manual candidates", async () => {
    const options = baseOptions();
    const identify = vi.fn(async () => highConfidenceCandidates);
    const manualCandidate: IdentificationCandidate = {
      speciesKey: "ficus-lyrata",
      canonicalName: "Ficus lyrata",
      commonName: "Fiddle-leaf fig",
      score: 1,
      type: "tropical",
    };

    const { result } = renderHook(() =>
      useIdentificationFlow({
        identify,
        plantNetConfigured: true,
        maxPhotos: 3,
        getPreparedImages: options.getPreparedImages,
        onReset: vi.fn(),
        onStatus: options.onStatus,
        onError: options.onError,
        onManualModeChange: options.onManualModeChange,
        runPolicyForCandidate: options.runPolicyForCandidate,
        setSelectedKey: options.setSelectedKey,
        startRun: options.tracker.startRun,
        finishRun: options.tracker.finishRun,
        isRunStale: options.tracker.isRunStale,
      }),
    );

    await act(async () => {
      await result.current.applyManualCandidate(manualCandidate);
    });

    expect(result.current.candidates).toEqual([manualCandidate]);
    expect(options.runPolicyForCandidate).toHaveBeenCalledWith(manualCandidate);
  });

  it("surfaces identification errors", async () => {
    const options = baseOptions();
    const identify = vi.fn(async () => {
      throw new Error("service down");
    });

    const { result } = renderHook(() =>
      useIdentificationFlow({
        identify,
        plantNetConfigured: false,
        maxPhotos: 3,
        getPreparedImages: options.getPreparedImages,
        onReset: vi.fn(),
        onStatus: options.onStatus,
        onError: options.onError,
        onManualModeChange: options.onManualModeChange,
        runPolicyForCandidate: options.runPolicyForCandidate,
        setSelectedKey: options.setSelectedKey,
        startRun: options.tracker.startRun,
        finishRun: options.tracker.finishRun,
        isRunStale: options.tracker.isRunStale,
      }),
    );

    await act(async () => {
      await result.current.identifyWithImages(images);
    });

    expect(options.onError).toHaveBeenCalledWith({ type: "identify", message: "service down" });
    expect(options.onManualModeChange).toHaveBeenCalledWith(true);
  });
});
