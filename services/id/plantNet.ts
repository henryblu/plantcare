import { isAcceptedImageMimeType, type AcceptedImageMimeType } from "@core/constants/image";
import type { IdentifyRequest, IdentificationCandidate, PlantImageInput } from "./types";
import { normalizeSpeciesKey } from "./types";

const DEFAULT_ENDPOINT = "/api/plantnet/identify";
const DEFAULT_CONTENT_TYPE = "image/jpeg";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_ATTEMPTS = 1;

export type PlantNetErrorCode = "NETWORK_ERROR" | "INVALID_IMAGE" | "API_ERROR";

export interface PlantNetErrorOptions {
  cause?: unknown;
  status?: number;
}

export class PlantNetError extends Error {
  readonly code: PlantNetErrorCode;
  readonly status?: number;

  constructor(code: PlantNetErrorCode, message: string, options: PlantNetErrorOptions = {}) {
    super(message);
    this.name = "PlantNetError";
    this.code = code;
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

const resolveMimeType = (image: PlantImageInput): string | null => {
  if (image.contentType && typeof image.contentType === "string") {
    return image.contentType.toLowerCase();
  }

  if (typeof Blob !== "undefined" && image.data instanceof Blob && image.data.type) {
    return image.data.type.toLowerCase();
  }

  return null;
};

const validateMimeType = (mime: string | null, index: number): AcceptedImageMimeType => {
  const normalized = mime?.toLowerCase() ?? null;
  if (normalized && isAcceptedImageMimeType(normalized)) {
    return normalized as AcceptedImageMimeType;
  }

  const hint = normalized ? ` (${normalized})` : "";
  throw new PlantNetError(
    "INVALID_IMAGE",
    `Image ${index + 1} must use JPEG, PNG, or WEBP format${hint}.`,
  );
};

const extensionFromMime = (mime: AcceptedImageMimeType): string => {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpeg":
    default:
      return "jpg";
  }
};

const toBlob = async (
  image: PlantImageInput,
  mimeType: AcceptedImageMimeType,
  fetchFn: typeof fetch,
): Promise<Blob> => {
  const type = mimeType || DEFAULT_CONTENT_TYPE;

  if (typeof Blob !== "undefined" && image.data instanceof Blob) {
    if (!image.data.type || image.data.type.toLowerCase() === type) {
      return image.data;
    }
    return new Blob([image.data], { type });
  }

  if (image.data instanceof ArrayBuffer) {
    return new Blob([image.data], { type });
  }

  if (image.data instanceof Uint8Array) {
    return new Blob([image.data], { type });
  }

  if (image.uri) {
    try {
      const response = await fetchFn(image.uri);
      if (!response.ok) {
        throw new PlantNetError(
          "INVALID_IMAGE",
          `Failed to fetch image from URI (status ${response.status}).`,
          { status: response.status },
        );
      }
      const blob = await response.blob();
      if (blob.type && blob.type.toLowerCase() === type) {
        return blob;
      }
      return new Blob([blob], { type });
    } catch (error) {
      if (error instanceof PlantNetError) {
        throw error;
      }
      throw new PlantNetError("INVALID_IMAGE", "Failed to load image from the provided URI.", {
        cause: error,
      });
    }
  }

  throw new PlantNetError("INVALID_IMAGE", "Image input requires binary data or a URI.");
};

const buildUrl = (options: PlantNetClientOptions, request: IdentifyRequest): string => {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    const base =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost";
    url = new URL(endpoint, base);
  }

  if (options.apiKey) {
    url.searchParams.set("api-key", options.apiKey);
  }

  const language = request.language ?? options.defaultLanguage;
  if (language) {
    url.searchParams.set("lang", language);
  }

  const project = options.project;
  if (project) {
    url.searchParams.set("project", project);
  }

  return url.toString();
};

const normalizeCandidate = (result: PlantNetResult): IdentificationCandidate | null => {
  if (!result.species) return null;
  const canonicalName =
    result.species.scientificNameWithoutAuthor || result.species.scientificName;

  if (!canonicalName) return null;

  const taxonId = result.species.gbif?.id !== undefined ? String(result.species.gbif.id) : undefined;
  const speciesKey = normalizeSpeciesKey(canonicalName, taxonId);
  const candidate: IdentificationCandidate = {
    speciesKey,
    canonicalName,
    commonName: result.species.commonNames?.[0],
    taxonId,
    score: typeof result.score === "number" ? result.score : 0,
    source: "plantnet",
  };

  return candidate;
};

const sortAndLimit = (
  candidates: IdentificationCandidate[],
  limit?: number,
): IdentificationCandidate[] => {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  if (limit && limit > 0) {
    return sorted.slice(0, limit);
  }
  return sorted;
};

const safeReadError = async (response: Response): Promise<string | undefined> => {
  try {
    const text = await response.text();
    return text ? text.slice(0, 200) : undefined;
  } catch (error) {
    return error instanceof Error ? error.message : undefined;
  }
};

export interface PlantNetClientOptions {
  apiKey?: string;
  endpoint?: string;
  project?: string;
  fetchFn?: typeof fetch;
  defaultOrgans?: string[];
  defaultLanguage?: string;
  defaultLimit?: number;
  timeoutMs?: number;
  retryAttempts?: number;
}

interface PlantNetGbifEntry {
  id?: number | string;
}

interface PlantNetSpecies {
  scientificName?: string;
  scientificNameWithoutAuthor?: string;
  commonNames?: string[];
  gbif?: PlantNetGbifEntry;
}

interface PlantNetResult {
  score?: number;
  species?: PlantNetSpecies;
}

interface PlantNetResponse {
  results?: PlantNetResult[];
  error?: string;
}

export class PlantNetClient {
  private readonly fetchFn: typeof fetch;
  private readonly options: PlantNetClientOptions;
  private readonly timeoutMs: number;
  private readonly retryAttempts: number;

  constructor(options: PlantNetClientOptions) {
    this.options = options;
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    if (typeof AbortController === "undefined" || this.timeoutMs <= 0) {
      return this.fetchFn(url, init);
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchFn(url, { ...init, signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeError(error: unknown): PlantNetError {
    if (error instanceof PlantNetError) {
      return error;
    }

    if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
      return new PlantNetError("NETWORK_ERROR", "PlantNet request timed out. Please try again.", {
        cause: error,
      });
    }

    if (error instanceof TypeError) {
      return new PlantNetError(
        "NETWORK_ERROR",
        "Unable to reach PlantNet. Check your connection and try again.",
        { cause: error },
      );
    }

    if (error instanceof Error) {
      return new PlantNetError("API_ERROR", error.message, { cause: error });
    }

    return new PlantNetError("API_ERROR", "PlantNet request failed.");
  }

  async identify(request: IdentifyRequest): Promise<IdentificationCandidate[]> {
    if (!request.images || request.images.length === 0) {
      throw new PlantNetError("INVALID_IMAGE", "identify requires at least one image.");
    }

    if (typeof FormData === "undefined") {
      throw new PlantNetError("INVALID_IMAGE", "FormData support is required to upload images.");
    }

    const validatedInputs = request.images.map((image, index) => ({
      image,
      mime: validateMimeType(resolveMimeType(image), index),
    }));

    const formData = new FormData();
    const organs = request.organs ?? this.options.defaultOrgans ?? ["leaf"];
    organs.forEach((organ) => formData.append("organs", organ));

    const blobs = await Promise.all(
      validatedInputs.map(({ image, mime }) => toBlob(image, mime, this.fetchFn)),
    );

    blobs.forEach((blob, index) => {
      const { image, mime } = validatedInputs[index];
      const filename = image.filename ?? `image-${index + 1}.${extensionFromMime(mime)}`;
      formData.append("images", blob, filename);
    });

    const url = buildUrl(this.options, request);
    const attempts = Math.max(1, this.retryAttempts + 1);
    let lastError: PlantNetError | null = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const details = await safeReadError(response);
          throw new PlantNetError(
            "API_ERROR",
            details
              ? `PlantNet identify request failed (${response.status}): ${details}`
              : `PlantNet identify request failed (${response.status}).`,
            { status: response.status },
          );
        }

        const payload: PlantNetResponse = await response.json();
        if (payload.error) {
          throw new PlantNetError("API_ERROR", `PlantNet identify error: ${payload.error}`);
        }

        const candidates = (payload.results ?? [])
          .map(normalizeCandidate)
          .filter((candidate): candidate is IdentificationCandidate => candidate !== null);

        return sortAndLimit(candidates, request.limit ?? this.options.defaultLimit);
      } catch (error) {
        const normalized = this.normalizeError(error);
        if (normalized.code === "INVALID_IMAGE") {
          throw normalized;
        }

        lastError = normalized;
        const hasMoreAttempts = attempt < attempts - 1;
        const shouldRetry = hasMoreAttempts && normalized.code === "NETWORK_ERROR";

        if (shouldRetry) {
          if (typeof console !== "undefined" && typeof console.warn === "function") {
            console.warn(`[PlantNet] identify retry ${attempt + 1} after network error`, normalized);
          }
          continue;
        }

        throw normalized;
      }
    }

    throw lastError ?? new PlantNetError("NETWORK_ERROR", "PlantNet request failed.");
  }
}
