# Smart Plant MVP

## Getting Started
1. Copy `.env.sample` to `.env` and provide API keys.
2. Install dependencies (e.g., `npm install`) once the app scaffold is in place.
3. Run the app in mock mode first to verify flows without external services.

## Running Modes
- **Mock mode** (`USE_MOCKS=true`): bypasses network calls for offline demos.
- **Live mode** (`USE_MOCKS=false`): uses PlantNet and ChatGPT when API keys are present.

Toggle feature flags via environment variables defined in `config/featureFlags.ts` to switch providers on or off during development.
