import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createChatGptPolicyService, getDefaultPolicySeeds } from '../services/policy/chatgpt';
import { createSpeciesCacheFlow } from '../core/orchestration/cacheFlow';
import { createPlantFlow } from '../core/orchestration/createPlantFlow';
import { PlantStore } from '../core/state/store';
import { createMemoryStorage } from '../services/storage/memoryAdapter';
const rootDir = path.resolve(__dirname, '..');
const loadEnvFile = async () => {
    const envPath = path.join(rootDir, '.env');
    try {
        const content = await fs.readFile(envPath, 'utf8');
        content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#'))
            .forEach((line) => {
            const [key, ...rest] = line.split('=');
            if (!key)
                return;
            const value = rest.join('=').trim();
            if (!(key in process.env)) {
                process.env[key] = value;
            }
        });
    }
    catch (error) {
        throw new Error(`Failed to load .env at ${envPath}: ${error.message}`);
    }
};
const run = async () => {
    await loadEnvFile();
    const storage = createMemoryStorage();
    const store = new PlantStore(storage);
    await store.hydrate();
    const policyService = createChatGptPolicyService({
        apiKey: process.env.OPENAI_API_KEY?.trim(),
        seedPolicies: getDefaultPolicySeeds(),
    });
    const cacheFlow = createSpeciesCacheFlow({ store, policyService });
    const flow = createPlantFlow({ store, cacheFlow });
    const plant = await flow.execute({
        species: {
            speciesKey: 'epipremnum-aureum',
            canonicalName: 'Epipremnum aureum',
            commonName: 'Golden pothos',
            type: 'tropical',
            confidence: 0.91,
            hints: ['Trailing vine', 'Handles low to medium light'],
        },
        plant: {
            nickname: 'Office Pothos',
            location: 'Workspace shelf',
            notes: 'Keep away from HVAC vents.',
        },
        forcePolicyRefresh: false,
    });
    console.log('Created plant record:');
    console.dir(plant, { depth: null });
    const state = store.getState();
    console.log('\nStore snapshot:');
    console.dir(state, { depth: null });
};
run().catch((error) => {
    console.error('Create plant flow script failed:', error);
    process.exitCode = 1;
});
