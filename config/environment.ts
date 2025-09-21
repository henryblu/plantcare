const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

const readImportMetaEnv = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && typeof import.meta.env === 'object') {
      const value = (import.meta.env as Record<string, unknown>)[key];
      return typeof value === 'string' ? value : undefined;
    }
  } catch {
    // Accessing import.meta can throw in some SSR/node environments; ignore.
  }
  return undefined;
};

const readProcessEnv = (key: string): string | undefined => {
  if (typeof process === 'undefined' || typeof process.env !== 'object') {
    return undefined;
  }
  const value = process.env[key];
  return typeof value === 'string' ? value : undefined;
};

const readEnv = (key: string): string | undefined => {
  const fromImportMeta = readImportMetaEnv(key);
  if (typeof fromImportMeta === 'string' && fromImportMeta.trim().length > 0) {
    return fromImportMeta;
  }
  const fromProcess = readProcessEnv(key);
  if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
    return fromProcess;
  }
  return undefined;
};

export const getEnvVar = (key: string, fallback = ''): string => {
  const value = readEnv(key);
  return value !== undefined ? value : fallback;
};

export const getOptionalEnvVar = (key: string): string | undefined => {
  const value = readEnv(key);
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getBooleanEnvVar = (key: string, fallback = false): boolean => {
  const value = readEnv(key);
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
};

export const DEFAULT_PLANTNET_ENDPOINT = '/api/plantnet/identify';
export const DEFAULT_OPENAI_POLICY_ENDPOINT = '/api/openai/policy';

export interface PlantNetRuntimeConfig {
  endpoint: string;
  configured: boolean;
}

export interface OpenAiRuntimeConfig {
  endpoint: string;
  apiKey?: string;
  usesProxy: boolean;
  configured: boolean;
}

export interface RuntimeServicesConfig {
  plantNet: PlantNetRuntimeConfig;
  openAi: OpenAiRuntimeConfig;
}

export const getRuntimeServicesConfig = (): RuntimeServicesConfig => {
  const plantNetEndpointOverride = getOptionalEnvVar('VITE_PLANTNET_ENDPOINT');
  const plantNetEndpoint = plantNetEndpointOverride ?? DEFAULT_PLANTNET_ENDPOINT;
  const plantNetConfigured = plantNetEndpoint.startsWith('/') || Boolean(plantNetEndpointOverride);

  const openAiEndpointOverride = getOptionalEnvVar('VITE_OPENAI_ENDPOINT');
  const openAiEndpoint = openAiEndpointOverride ?? DEFAULT_OPENAI_POLICY_ENDPOINT;
  const openAiUsesProxy = openAiEndpoint.startsWith('/');
  const openAiApiKeyCandidate = getOptionalEnvVar('VITE_OPENAI_API_KEY');
  const openAiApiKey = openAiUsesProxy ? undefined : openAiApiKeyCandidate;
  const openAiConfigured = openAiUsesProxy || Boolean(openAiEndpointOverride) || Boolean(openAiApiKey);

  return {
    plantNet: {
      endpoint: plantNetEndpoint,
      configured: plantNetConfigured,
    },
    openAi: {
      endpoint: openAiEndpoint,
      apiKey: openAiApiKey,
      usesProxy: openAiUsesProxy,
      configured: openAiConfigured,
    },
  };
};
