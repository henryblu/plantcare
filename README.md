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

## Documentation Map
All project knowledge now lives under [`docs/`](docs/). Start with the following entry points when planning changes:

- [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) – product snapshot, engineering principles, roadmap, and contribution workflow consolidated from the former root guides.
- [`docs/CODING_GUIDELINES.md`](docs/CODING_GUIDELINES.md) – module structure, configuration rules, and expectations for tests and documentation updates.
- [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md) – UI tokens, layout rules, and accessibility expectations.
- [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) and [`docs/SCHEMAS.md`](docs/SCHEMAS.md) – external service payloads and shared data models.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) and [`docs/storage-backends.md`](docs/storage-backends.md) – environment setup, feature flags, and persistence options.
- [`docs/adr/`](docs/adr) – architectural decisions to review before proposing large structural changes.

Each document lists the scenarios it supports so contributors (and Codex) can quickly identify the material they need before implementing changes.

## Storage backends

The storage adapter now supports SQLite and AsyncStorage backends with versioned
schema envelopes. See [`docs/storage-backends.md`](docs/storage-backends.md) for
details on choosing a backend and how migrations are handled.
