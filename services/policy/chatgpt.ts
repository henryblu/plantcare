import { OPENAI_API_KEY } from '../../config/constants';
import {
  normalizeSpeciesProfile,
  SpeciesProfile,
  SpeciesType,
} from '../../core/models/speciesProfile';
import type { MoisturePolicy } from '../../core/models/moisturePolicy';
import {
  normalizePolicyPayload,
  PolicySchemaError,
  SUPPORTED_SPECIES_TYPES,
} from '../../core/logic/policySchema';

export interface PolicyGenerationRequest {
  speciesKey: string;
  canonicalName: string;
  commonName?: string;
  type?: SpeciesType;
  confidence?: number;
  hints?: string[];
}

export interface ChatGptPolicyServiceOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxAttempts?: number;
  endpoint?: string;
  fetchFn?: typeof fetch;
  seedPolicies?: Partial<Record<SpeciesType, MoisturePolicy>>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAiChatChoice {
  message?: {
    content?: string;
  };
  finish_reason?: string;
}

interface OpenAiChatResponse {
  choices?: OpenAiChatChoice[];
}

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_PROXY_ENDPOINT = '/api/openai/policy';

const resolveEndpointUrl = (endpoint: string): string => {
  if (!endpoint) {
    throw new Error('ChatGPT endpoint is not configured.');
  }

  try {
    return new URL(endpoint).toString();
  } catch {
    let base: string | undefined;

    if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
      base = window.location.origin;
    } else if (
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as { location?: { origin?: string } }).location?.origin === 'string'
    ) {
      base = (globalThis as { location: { origin: string } }).location.origin;
    }

    return new URL(endpoint, base ?? 'http://localhost').toString();
  }
};
const cloneMoisturePolicy = (policy: MoisturePolicy): MoisturePolicy => ({
  ...policy,
  notes: [...policy.notes],
});

const DEFAULT_POLICY_SEEDS: Record<SpeciesType, MoisturePolicy> = {
  succulent: {
    waterIntervalDays: 14,
    soilMoistureThreshold: 15,
    humidityPreference: 'low',
    lightRequirement: 'full-sun',
    notes: [
      'Allow soil to dry completely before the next watering.',
      'Use a gritty, fast-draining substrate and abundant light.',
    ],
  },
  'semi-succulent': {
    waterIntervalDays: 10,
    soilMoistureThreshold: 25,
    humidityPreference: 'medium',
    lightRequirement: 'bright-indirect',
    notes: [
      'Water once the top 2–3 cm of soil are dry to the touch.',
      'Ensure drainage holes and avoid water pooling in the crown.',
    ],
  },
  tropical: {
    waterIntervalDays: 6,
    soilMoistureThreshold: 35,
    humidityPreference: 'high',
    lightRequirement: 'bright-indirect',
    notes: [
      'Maintain warm temperatures and boost humidity above 60%.',
      'Protect from harsh direct sun while keeping light levels high.',
    ],
  },
  fern: {
    waterIntervalDays: 4,
    soilMoistureThreshold: 45,
    humidityPreference: 'high',
    lightRequirement: 'medium',
    notes: [
      'Keep soil evenly moist; never allow complete drying.',
      'Provide constant humidity via pebble tray or humidifier.',
    ],
  },
  other: {
    waterIntervalDays: 7,
    soilMoistureThreshold: 30,
    humidityPreference: 'medium',
    lightRequirement: 'medium',
    notes: [
      'Let the top inch of soil dry before watering again.',
      'Adjust schedule based on seasonal light and temperature shifts.',
    ],
  },
};

const SEED_TYPES: readonly SpeciesType[] = ['succulent', 'semi-succulent', 'tropical', 'fern'] as const;

const resolveSpeciesType = (type: SpeciesType | undefined): SpeciesType => {
  if (!type) return 'other';
  const normalized = type.trim().toLowerCase() as SpeciesType;
  return SUPPORTED_SPECIES_TYPES.includes(normalized) ? normalized : 'other';
};

const sanitizeHint = (value: string): string => value.trim();

const buildSystemPrompt = (): string =>
  [
    "You are Smart Plant's horticulture specialist.",
    'Return a single JSON object and nothing else.',
    'The JSON must match this structure exactly:',
    '{',
    '  "type": "succulent" | "semi-succulent" | "tropical" | "fern" | "other",',
    '  "moisturePolicy": {',
    '    "waterIntervalDays": integer (0-60),',
    '    "soilMoistureThreshold": integer (0-60),',
    '    "humidityPreference": "low" | "medium" | "high",',
    '    "lightRequirement": "low" | "medium" | "bright-indirect" | "full-sun",',
    '    "notes": array of 0-2 concise care notes (<=160 characters each)',
    '  }',
    '}',
    'No prose, no markdown fences, no trailing commentary.',
    'Clamp values to safe indoor ranges when unsure.',
    'Always include two helpful notes when possible.',
  ].join('\n');

const formatUserPrompt = (request: PolicyGenerationRequest, fallbackType: SpeciesType): string => {
  const hints = (request.hints ?? [])
    .map(sanitizeHint)
    .filter((hint) => hint.length > 0);

  const typeLine = request.type
    ? `Suggested species type: ${request.type}`
    : `Suggested species type: ${fallbackType} (best guess)`;

  const lines: string[] = [
    `Species canonical name: ${request.canonicalName}`,
    `Species key: ${request.speciesKey}`,
    typeLine,
  ];

  if (request.commonName) {
    lines.push(`Common name: ${request.commonName}`);
  }

  if (typeof request.confidence === 'number') {
    lines.push(`Identification confidence: ${(request.confidence * 100).toFixed(1)}%`);
  }

  if (hints.length > 0) {
    lines.push('Additional cues:');
    hints.forEach((hint) => lines.push(`- ${hint}`));
  }

  lines.push('Generate the policy JSON now.');
  return lines.join('\n');
};

const mapSeedPolicies = (
  overrides: Partial<Record<SpeciesType, MoisturePolicy>> | undefined,
): Record<SpeciesType, MoisturePolicy> => {
  const merged: Record<SpeciesType, MoisturePolicy> = { ...DEFAULT_POLICY_SEEDS };
  if (!overrides) return merged;

  Object.entries(overrides).forEach(([key, policy]) => {
    const type = key as SpeciesType;
    if (policy && SUPPORTED_SPECIES_TYPES.includes(type)) {
      merged[type] = cloneMoisturePolicy(policy);
    }
  });

  return merged;
};

export class ChatGptPolicyService {
  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxAttempts: number;
  private readonly fetchFn?: typeof fetch;
  private readonly seedPolicies: Record<SpeciesType, MoisturePolicy>;

  constructor(options: ChatGptPolicyServiceOptions = {}) {
    const resolvedKey = (options.apiKey ?? OPENAI_API_KEY)?.trim();
    this.apiKey = resolvedKey && resolvedKey.length > 0 ? resolvedKey : undefined;
    this.endpoint = options.endpoint ?? (this.apiKey ? DEFAULT_OPENAI_ENDPOINT : DEFAULT_PROXY_ENDPOINT);
    this.model = options.model ?? DEFAULT_MODEL;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    const attempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.maxAttempts = Number.isFinite(attempts) && attempts > 0 ? Math.min(Math.floor(attempts), 3) : DEFAULT_MAX_ATTEMPTS;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.seedPolicies = mapSeedPolicies(options.seedPolicies);
  }

  async generate(request: PolicyGenerationRequest): Promise<SpeciesProfile> {
    const normalizedRequest = this.normalizeRequest(request);
    const fallbackType = resolveSpeciesType(normalizedRequest.type);
    const timestamp = new Date().toISOString();

    if (typeof this.fetchFn !== 'function') {
      return this.buildSeedProfile(normalizedRequest, fallbackType, timestamp);
    }

    const endpoint = this.endpoint;
    const apiKey = this.apiKey;
    const requiresApiKey = /^https?:\/\//i.test(endpoint) && endpoint.includes('api.openai.com');
    if (!apiKey && requiresApiKey) {
      return this.buildSeedProfile(normalizedRequest, fallbackType, timestamp);
    }

    const conversation: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: formatUserPrompt(normalizedRequest, fallbackType) },
    ];

    let lastError: unknown;
    let lastContent: string | undefined;

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      try {
        lastContent = await this.invokeOpenAi(endpoint, apiKey, conversation);
      } catch (error) {
        lastError = error;
        break;
      }

      if (!lastContent) {
        lastError = new Error('ChatGPT returned an empty response.');
      } else {
        try {
          const parsed = JSON.parse(lastContent);
          const normalized = normalizePolicyPayload(parsed, { fallbackType });
          return this.buildProfile(normalizedRequest, normalized, 'chatgpt', timestamp);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      if (attempt < this.maxAttempts - 1) {
        const guidance =
          lastError instanceof PolicySchemaError || lastError instanceof SyntaxError
            ? lastError.message
            : 'The JSON was invalid. Follow the schema exactly.';
        conversation.push({ role: 'assistant', content: lastContent ?? '' });
        conversation.push({
          role: 'user',
          content: `The previous JSON was invalid because: ${guidance}. Reply with corrected JSON only.`,
        });
      }
    }

    if (lastError && typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[ChatGPT] Falling back to seed policy', lastError);
    }

    return this.buildSeedProfile(normalizedRequest, fallbackType, timestamp);
  }

  private normalizeRequest(request: PolicyGenerationRequest): PolicyGenerationRequest {
    const speciesKey = request.speciesKey?.trim();
    const canonicalName = request.canonicalName?.trim();
    if (!speciesKey) {
      throw new Error('Policy generation requires a speciesKey.');
    }
    if (!canonicalName) {
      throw new Error('Policy generation requires a canonical species name.');
    }
    return {
      speciesKey,
      canonicalName,
      commonName: request.commonName?.trim() || undefined,
      type: request.type ? (request.type.trim() as SpeciesType) : undefined,
      confidence: typeof request.confidence === 'number' ? request.confidence : undefined,
      hints: request.hints?.map(sanitizeHint).filter((hint) => hint.length > 0),
    };
  }

  private async invokeOpenAi(
    endpoint: string,
    apiKey: string | undefined,
    messages: ChatMessage[],
  ): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const requestUrl = resolveEndpointUrl(endpoint);
    if (typeof console !== 'undefined' && typeof console.info === 'function') {
      console.info('[ChatGPT] POST', requestUrl);
    }

    const response = await this.fetchFn!(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
        messages,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const details = await this.safeReadError(response);
      throw new Error(`ChatGPT request failed with status ${response.status}${details ? `: ${details}` : ''}`);
    }

    const payload: OpenAiChatResponse = await response.json();
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('ChatGPT response missing content.');
    }
    return content;
  }

  private async safeReadError(response: FetchResponse): Promise<string | undefined> {
    try {
      const text = await response.text();
      return text ? text.slice(0, 500) : undefined;
    } catch (error) {
      return error instanceof Error ? error.message : undefined;
    }
  }

  private buildProfile(
    request: PolicyGenerationRequest,
    normalized: { type: SpeciesType; moisturePolicy: MoisturePolicy },
    source: 'chatgpt' | 'seed',
    timestamp: string,
  ): SpeciesProfile {
    const profile: SpeciesProfile = {
      speciesKey: request.speciesKey,
      canonicalName: request.canonicalName,
      commonName: request.commonName,
      type: normalized.type,
      confidence: request.confidence,
      moisturePolicy: cloneMoisturePolicy(normalized.moisturePolicy),
      source,
      updatedAt: timestamp,
      createdAt: timestamp,
    };
    return normalizeSpeciesProfile(profile);
  }

  private buildSeedProfile(
    request: PolicyGenerationRequest,
    fallbackType: SpeciesType,
    timestamp: string,
  ): SpeciesProfile {
    const preferredType = SEED_TYPES.includes(fallbackType) ? fallbackType : 'other';
    const policy = cloneMoisturePolicy(this.seedPolicies[preferredType] ?? this.seedPolicies.other);
    const normalizedPolicy = normalizePolicyPayload(
      {
        type: preferredType,
        moisturePolicy: policy,
      },
      { fallbackType: preferredType },
    );
    return this.buildProfile(request, normalizedPolicy, 'seed', timestamp);
  }
}

export const createChatGptPolicyService = (
  options: ChatGptPolicyServiceOptions = {},
): ChatGptPolicyService => new ChatGptPolicyService(options);

export const getDefaultPolicySeeds = (): Record<SpeciesType, MoisturePolicy> => ({
  succulent: cloneMoisturePolicy(DEFAULT_POLICY_SEEDS.succulent),
  'semi-succulent': cloneMoisturePolicy(DEFAULT_POLICY_SEEDS['semi-succulent']),
  tropical: cloneMoisturePolicy(DEFAULT_POLICY_SEEDS.tropical),
  fern: cloneMoisturePolicy(DEFAULT_POLICY_SEEDS.fern),
  other: cloneMoisturePolicy(DEFAULT_POLICY_SEEDS.other),
});




