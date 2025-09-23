/**
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useImagePreparation } from "@app/features/addPlant/hooks/useImagePreparation";
import type { PreparedImageFile } from "@app/utils/imageProcessing";

vi.mock("@app/utils/imageProcessing", () => {
  class MockValidationError extends Error {}
  return {
    prepareImageFile: vi.fn(),
    ImageValidationError: MockValidationError,
  };
});

let prepareImageFile: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  const module = await import("@app/utils/imageProcessing");
  prepareImageFile = module.prepareImageFile as ReturnType<typeof vi.fn>;
});

describe("useImagePreparation", () => {
  const basePreparedImage = (overrides: Partial<PreparedImageFile> = {}): PreparedImageFile => ({
    file: new File(["content"], overrides.file?.name ?? "photo.jpg", { type: "image/jpeg" }),
    width: 800,
    height: 600,
    originalWidth: 1024,
    originalHeight: 768,
    wasDownscaled: false,
    ...overrides,
  });

  const createHooks = () => {
    const onResetResults = vi.fn();
    const onStatus = vi.fn();
    const onError = vi.fn();
    const onManualModeChange = vi.fn();
    const onAssessmentsCleared = vi.fn();
    const onPhotosPrepared = vi.fn();

    const rendered = renderHook(() =>
      useImagePreparation({
        plantNetConfigured: true,
        maxPhotos: 3,
        onResetResults,
        onStatus,
        onError,
        onManualModeChange,
        onAssessmentsCleared,
        onPhotosPrepared,
      }),
    );

    return { rendered, onResetResults, onStatus, onError, onManualModeChange, onAssessmentsCleared, onPhotosPrepared };
  };

  it("prepares the primary photo", async () => {
    const prepared = basePreparedImage();
    prepareImageFile.mockResolvedValueOnce(prepared);
    const { rendered, onStatus, onError, onManualModeChange, onAssessmentsCleared, onPhotosPrepared } = createHooks();
    const file = new File(["primary"], "primary.jpg", { type: "image/jpeg" });

    await act(async () => {
      await rendered.result.current.handleFileChange({ target: { files: [file], value: "" } } as any);
    });

    expect(rendered.result.current.preparedImages).toEqual([prepared]);
    expect(onStatus).toHaveBeenNthCalledWith(1, { kind: "image-processing", message: expect.any(String) });
    expect(onStatus).toHaveBeenLastCalledWith({ kind: "image-ready", message: expect.any(String) });
    expect(onError).toHaveBeenLastCalledWith(null);
    expect(onManualModeChange).toHaveBeenCalledWith(false);
    expect(onAssessmentsCleared).toHaveBeenCalled();
    expect(onPhotosPrepared).toHaveBeenCalledWith([prepared], { reason: "primary" });
  });

  it("appends an additional photo and reuses callbacks", async () => {
    const first = basePreparedImage();
    const second = basePreparedImage({ file: new File(["second"], "second.jpg", { type: "image/jpeg" }) });
    prepareImageFile.mockResolvedValueOnce(first);
    const hooks = createHooks();

    await act(async () => {
      await hooks.rendered.result.current.handleFileChange({ target: { files: [first.file], value: "" } } as any);
    });

    prepareImageFile.mockResolvedValueOnce(second);

    await act(async () => {
      await hooks.rendered.result.current.handleAdditionalPhotoChange({
        target: { files: [second.file], value: "" },
      } as any);
    });

    expect(hooks.rendered.result.current.preparedImages).toEqual([first, second]);
    expect(hooks.onAssessmentsCleared).toHaveBeenCalledTimes(2);
    expect(hooks.onPhotosPrepared).toHaveBeenLastCalledWith([first, second], { reason: "additional" });
  });

  it("surfaces image validation errors", async () => {
    const hooks = createHooks();
    prepareImageFile.mockRejectedValueOnce(new Error("bad image"));
    const file = new File(["bad"], "bad.jpg", { type: "image/jpeg" });

    await act(async () => {
      await hooks.rendered.result.current.handleFileChange({ target: { files: [file], value: "" } } as any);
    });

    expect(hooks.onError).toHaveBeenLastCalledWith({ type: "image", message: "bad image" });
    expect(hooks.rendered.result.current.preparedImages).toEqual([]);
  });

  it("resets when choosing a different photo", () => {
    const hooks = createHooks();
    const trigger = vi.fn();
    const additionalTrigger = vi.fn();
    hooks.rendered.result.current.fileInputRef.current = { click: trigger, value: "existing" } as any;
    hooks.rendered.result.current.additionalFileInputRef.current = { click: additionalTrigger, value: "extra" } as any;

    act(() => {
      hooks.rendered.result.current.handleChooseDifferentPhoto();
    });

    expect(hooks.onResetResults).toHaveBeenCalled();
    expect(hooks.onAssessmentsCleared).toHaveBeenCalled();
    expect(trigger).toHaveBeenCalled();
    expect(hooks.rendered.result.current.preparedImages).toEqual([]);
    expect(hooks.rendered.result.current.fileInputRef.current?.value).toBe("");
    expect(hooks.rendered.result.current.additionalFileInputRef.current?.value).toBe("");
  });
});
  beforeEach(() => {
    prepareImageFile.mockReset();
  });

