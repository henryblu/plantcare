# Smart Plant Coding Guidelines

## 1. Core Scope
- Anchor every feature to the MVP loop: **Photo → PlantNet ID → ChatGPT Moisture Policy → Cache/Store → Dashboard Summary**.
- Never send photos or raw images to ChatGPT; it should only receive metadata.
- Reuse species moisture policies from cache for 180 days (keyed by PlantNet `taxonId` or normalized species name).
- Validate and clamp all policy responses against the shared schemas; fallback to seeded defaults after a single retry on invalid payloads.

## 2. Architecture & Module Boundaries
- Preserve the repo structure: `app/` (UI), `core/` (models + orchestration), `services/` (integrations), `config/`, `docs/`, `assets/`, `scripts/`, `tests/`.
- Keep modules decoupled and flows composable; UI screens should invoke orchestration helpers rather than duplicating business logic.
- Treat orchestration as the place for retries, caching, and persistence; presentation components stay declarative.

## 3. Configuration & Feature Flags
- Centralize environment variables in `config/constants.ts`; mirror updates in `.env.sample` and document them in the README.
- Use existing flags (`FEATURE_PLANTNET`, `FEATURE_CHATGPT`, `USE_MOCK_PLANTNET`, `USE_MOCK_CHATGPT`) instead of adding bespoke toggles; default demos to mock mode.
- Guard all new feature flags with documentation on expected behaviors in mock vs. live modes.

## 4. Data Contracts & Validation
- Maintain JSON schemas and TypeScript models for `Plant`, `SpeciesProfile`, and `MoisturePolicy` in lockstep; `docs/SCHEMAS.md` remains authoritative.
- Validate every external response (PlantNet, ChatGPT) and reject partial saves; retry once before applying deterministic fallbacks tagged with their origin.
- Keep validation logic reusable and centrally located to avoid drift across modules.

## 5. External Services & Mocking
- Gate all network calls through providers in `services/`; mocks and live clients must share the same interface.
- Capture request/response samples (mock and live) in `docs/API_CONTRACTS.md`, including retry semantics and error handling expectations.
- Preserve manual species entry as a first-class path so offline/mock modes remain fully usable.

## 6. State, Caching & Persistence
- Centralize shared state management in `core/state/store.ts` and expose mutations through typed actions.
- Enforce cache TTL (180 days) keyed by PlantNet identifiers; make caching logic deterministic and testable.
- Persist plant data through storage adapters so behavior matches between mock and live environments.

## 7. Testing & QA
- Expand `tests/` with unit coverage for cache TTL logic, schema validation/clamping, and critical pure utilities.
- Add integration smoke tests for cache reuse, offline behavior, and mock/live parity before shipping features.
- No feature merges without confirming automated tests and targeted manual checks for the MVP guarantees.

## 8. Documentation & Handoff
- Keep README setup steps and `docs/OPERATIONS.md` current with feature flags, scripts, and run instructions.
- Version control demo assets and seed scripts under `assets/` to ensure mock mode stays reliable.
- Update `TASKS.md` and `PROJECT_BRIEF.md` whenever prompts, API contracts, or milestone expectations change.

## 9. Coding Style & Practices
- Favor small, pure functions with explicit typing; isolate side effects for auditability and portability.
- Minimize new dependencies; prefer utilities inside `core/` or `services/` to keep the stack lean.
- When crafting new prompts, specify the target module, desired flow behavior, required flags/schemas, and expected tests to maintain scope and interoperability.
