import { describe, expect, it, vi } from 'vitest';
import { createChatGptPolicyService, type PolicyGenerationRequest } from './chatgpt';

describe('ChatGptPolicyService', () => {
  const request: PolicyGenerationRequest = {
    speciesKey: 'ficus-lyrata',
    canonicalName: 'Ficus lyrata',
    type: 'tropical',
  };

  const payload = {
    type: 'tropical' as const,
    moisturePolicy: {
      waterIntervalDays: 7,
      soilMoistureThreshold: 30,
      humidityPreference: 'high',
      lightRequirement: 'bright-indirect',
      notes: ['Keep soil consistently moist.', 'Mist foliage weekly.'],
    },
  };

  it('resolves relative proxy endpoint before invoking fetch', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toBe('http://localhost/api/openai/policy');
      expect(init?.method).toBe('POST');

      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });

    const service = createChatGptPolicyService({
      endpoint: '/api/openai/policy',
      fetchFn: fetchMock,
    });

    const profile = await service.generate(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(profile.moisturePolicy.waterIntervalDays).toBe(payload.moisturePolicy.waterIntervalDays);
    expect(profile.source).toBe('chatgpt');
  });
});


