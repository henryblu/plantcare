import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createChatGptPolicyService, getDefaultPolicySeeds, } from '../services/policy/chatgpt';
const rootDir = path.resolve(__dirname, '..');
const DEFAULT_SPECIES = {
    speciesKey: 'monstera-deliciosa',
    canonicalName: 'Monstera deliciosa',
    commonName: 'Swiss cheese plant',
    type: 'tropical',
    confidence: 0.82,
    hints: ['Bright, filtered light', 'Prefers high humidity'],
};
const parseArgs = () => {
    const args = new Set(process.argv.slice(2));
    if (args.has('--live')) {
        return { mode: 'live', species: DEFAULT_SPECIES };
    }
    if (args.has('--seed')) {
        return { mode: 'seed', species: DEFAULT_SPECIES };
    }
    return { mode: 'mock', species: DEFAULT_SPECIES };
};
const loadEnvFile = async () => {
    const envPath = path.join(rootDir, '.env');
    try {
        const contents = await fs.readFile(envPath, 'utf8');
        contents
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
const createMockFetch = () => {
    const payload = {
        type: 'tropical',
        moisturePolicy: {
            waterIntervalDays: 7,
            soilMoistureThreshold: 28,
            humidityPreference: 'high',
            lightRequirement: 'bright-indirect',
            notes: ['Wipe leaves monthly to keep pores clear.', 'Fertilize every 4-6 weeks in growing season.'],
        },
    };
    const mockFetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), {
        headers: { 'Content-Type': 'application/json' },
    });
    return mockFetch;
};
const run = async () => {
    const config = parseArgs();
    await loadEnvFile();
    let service = createChatGptPolicyService({
        seedPolicies: getDefaultPolicySeeds(),
    });
    if (config.mode === 'mock') {
        service = createChatGptPolicyService({
            apiKey: 'mock-key',
            fetchFn: createMockFetch(),
        });
    }
    if (config.mode === 'live') {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is required for --live runs.');
        }
        service = createChatGptPolicyService({
            apiKey,
        });
    }
    if (config.mode === 'seed') {
        service = createChatGptPolicyService({
            apiKey: '',
            fetchFn: undefined,
        });
    }
    console.log(`Running policy generation in ${config.mode.toUpperCase()} mode...`);
    try {
        const profile = await service.generate(config.species);
        console.log('Received policy profile:');
        console.dir(profile, { depth: null });
    }
    catch (error) {
        console.error('Policy generation failed:', error);
        process.exitCode = 1;
    }
};
run().catch((error) => {
    console.error('Policy test script crashed:', error);
    process.exitCode = 1;
});
