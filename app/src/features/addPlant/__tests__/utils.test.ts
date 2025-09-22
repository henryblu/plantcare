import { describe, expect, it } from "vitest";
import type { IdentificationCandidate } from "@services/id/types";
import {
  buildPolicyRequest,
  formatPercentage,
  getCacheHitStatus,
  getIdentifyingStatus,
  getImageProcessingStatus,
  getImageReadyStatus,
  getPolicyGenerationStatus,
  getPolicyReadyStatus,
  ImageStatusInput,
} from "@app/features/addPlant/utils";

describe("buildPolicyRequest", () => {
  it("normalises manual-entry candidates to the fallback type", () => {
    const candidate: IdentificationCandidate = {
      speciesKey: "manual-snake-plant",
      canonicalName: "Dracaena trifasciata",
      commonName: "Snake Plant",
      score: 0.92,
      source: "manual",
    };

    const request = buildPolicyRequest(candidate);

    expect(request).toEqual({
      speciesKey: "manual-snake-plant",
      canonicalName: "Dracaena trifasciata",
      commonName: "Snake Plant",
      confidence: 0.92,
      type: "other",
    });
  });

  it("preserves recognised candidate types", () => {
    const candidate: IdentificationCandidate = {
      speciesKey: "succulent-123",
      canonicalName: "Aloe vera",
      score: 0.88,
      source: "plantnet",
      type: "succulent",
    };

    expect(buildPolicyRequest(candidate).type).toBe("succulent");
  });
});

describe("status helpers", () => {
  it("returns the cache-hit message", () => {
    expect(getCacheHitStatus()).toBe("Loaded cached care guide.");
  });

  it("formats policy generation messages", () => {
    expect(getPolicyGenerationStatus()).toBe("Generating care guide...");
    expect(getPolicyGenerationStatus(true)).toBe("Refreshing care guide...");
  });

  it("provides in-progress labels", () => {
    expect(getIdentifyingStatus()).toBe("Identifying species...");
    expect(getImageProcessingStatus()).toBe("Processing image...");
  });

  it("describes the generated care guide state", () => {
    expect(getPolicyReadyStatus()).toBe("All set! Review the care guide below.");
  });

  it("summarises prepared image details", () => {
    const original: ImageStatusInput = {
      width: 1024,
      height: 768,
      originalWidth: 1024,
      originalHeight: 768,
      wasDownscaled: false,
    };

    const downscaled: ImageStatusInput = {
      width: 1024,
      height: 768,
      originalWidth: 2048,
      originalHeight: 1536,
      wasDownscaled: true,
    };

    expect(getImageReadyStatus(original)).toBe("Image ready (1024x768px).");
    expect(getImageReadyStatus(downscaled)).toBe(
      "Image optimized to 1024x768px (down from 2048x1536px).",
    );
  });
});

describe("formatPercentage", () => {
  it("handles numeric inputs", () => {
    expect(formatPercentage(0.873)).toBe("87.3%");
  });

  it("guards against invalid values", () => {
    expect(formatPercentage(undefined)).toBe("N/A");
    expect(formatPercentage(Number.NaN)).toBe("N/A");
  });
});
