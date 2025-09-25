# Smart Plant MVP

## Getting Started
1. Copy `.env.sample` to `.env`. Keep the sample mock flags if you want to stay offline; supply real API keys when you are ready to call the live services.
2. Install dependencies: `npm install`.
3. Start the dev server: `npm run dev`.
4. When switching to live services, set `USE_MOCK_PLANTNET=false` and `USE_MOCK_CHATGPT=false`, then restart the dev server so the new flags apply.

## Running Modes
- **Offline mocks** (`USE_MOCK_PLANTNET=true`, `USE_MOCK_CHATGPT=true`): Plant identification uses canned candidates and policy guidance comes from seeded defaults. No API keys required.
- **Live services** (`USE_MOCK_PLANTNET=false`, `USE_MOCK_CHATGPT=false`): Requires `PLANTNET_API_KEY` plus either `OPENAI_API_KEY` or a proxy configuration. Remote calls go to PlantNet and ChatGPT.

Feature toggles are managed via environment variables surfaced in `config/featureFlags.ts`.

## Storage backends

The storage adapter now supports SQLite and AsyncStorage backends with versioned
schema envelopes. See [`docs/storage-backends.md`](docs/storage-backends.md) for
details on choosing a backend and how migrations are handled.
