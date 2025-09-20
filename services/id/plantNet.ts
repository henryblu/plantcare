import type { IdentifyRequest, IdentificationCandidate, PlantImageInput } from './types';
import { normalizeSpeciesKey } from './types';

const DEFAULT_ENDPOINT = '/api/plantnet/identify';
const DEFAULT_CONTENT_TYPE = 'image/jpeg';

export interface PlantNetClientOptions {
  apiKey?: string;
  endpoint?: string;
  project?: string;
  fetchFn?: typeof fetch;
  defaultOrgans?: string[];
  defaultLanguage?: string;
  defaultLimit?: number;
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

const toBlob = async (image: PlantImageInput, fetchFn: typeof fetch): Promise<Blob> => {
  const type = image.contentType ?? DEFAULT_CONTENT_TYPE;
  if (typeof Blob !== 'undefined' && image.data instanceof Blob) {
    return image.data;
  }

  if (image.data instanceof ArrayBuffer) {
    return new Blob([image.data], { type });
  }

  if (image.data instanceof Uint8Array) {
    const copy = new Uint8Array(image.data);
    return new Blob([copy.buffer], { type });
  }

  if (image.uri) {
    const response = await fetchFn(image.uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from URI: ${image.uri}`);
    }
    const blob = await response.blob();
    return blob;
  }

  throw new Error('Image input requires either binary data or a URI.');
};

const buildUrl = (options: PlantNetClientOptions, request: IdentifyRequest): string => {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
    url = new URL(endpoint, base);
  }

  if (options.apiKey) {
    url.searchParams.set('api-key', options.apiKey);
  }

  const language = request.language ?? options.defaultLanguage;
  if (language) {
    url.searchParams.set('lang', language);
  }

  const project = options.project;
  if (project) {
    url.searchParams.set('project', project);
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
    score: typeof result.score === 'number' ? result.score : 0,
    source: 'plantnet',
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

export class PlantNetClient {
  private readonly fetchFn: typeof fetch;
  private readonly options: PlantNetClientOptions;

  constructor(options: PlantNetClientOptions) {
    this.options = options;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async identify(request: IdentifyRequest): Promise<IdentificationCandidate[]> {
    if (!request.images || request.images.length === 0) {
      throw new Error('identify requires at least one image.');
    }

    if (typeof FormData === 'undefined') {
      throw new Error('FormData is required to call PlantNet identify endpoint.');
    }

    const formData = new FormData();
    const organs = request.organs ?? this.options.defaultOrgans ?? ['leaf'];
    organs.forEach((organ) => formData.append('organs', organ));

    const blobs = await Promise.all(request.images.map((image) => toBlob(image, this.fetchFn)));
    blobs.forEach((blob, index) => {
      const filename = request.images[index].filename ?? `image-${index + 1}.jpg`;
      formData.append('images', blob, filename);
    });

    const url = buildUrl(this.options, request);
    const response = await this.fetchFn(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`PlantNet identify request failed with status ${response.status}.`);
    }

    const payload: PlantNetResponse = await response.json();
    if (payload.error) {
      throw new Error(`PlantNet identify error: ${payload.error}`);
    }

    const candidates = (payload.results ?? [])
      .map(normalizeCandidate)
      .filter((candidate): candidate is IdentificationCandidate => candidate !== null);

    return sortAndLimit(candidates, request.limit ?? this.options.defaultLimit);
  }
}



