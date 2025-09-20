# Smart Plant – Execution Checklist

## Phase 0 — Repo & Environment
- [ ] Create repo structure (`app/`, `core/`, `services/`, `config/`, `docs/`, `assets/`, `scripts/`, `tests/`).
- [ ] Add `PROJECT_BRIEF.md`, `docs/API_CONTRACTS.md`, `docs/SCHEMAS.md`, and `TASKS.md` baselines.
- [ ] Provide `.env.sample` with `PLANTNET_API_KEY` and `OPENAI_API_KEY` placeholders.
- [ ] Add feature flags in `config/featureFlags.ts` (`FEATURE_PLANTNET`, `FEATURE_CHATGPT`, `USE_MOCKS`).
- [ ] Document run instructions (mock vs real) in `README.md`.
- ✅ **Done when**: App launches to a blank Home screen; env and flags are documented.

## Phase 1 — Data Contracts & Store
- [ ] Define models (`Plant`, `SpeciesProfile`, `MoisturePolicy`) in `core/models/*`.
- [ ] Mirror JSON schemas in `docs/SCHEMAS.md` with runtime types.
- [ ] Implement store in `core/state/store.ts` (plants[], speciesCache{}).
- [ ] Add persistence wrappers in `services/storage/*`.
- ✅ **Done when**: A dummy plant persists across restarts.

## Phase 2 — Identification (PlantNet)
- [ ] Implement `services/id/plantNet.ts` for photo upload and candidate parsing.
- [ ] Implement `services/id/provider.ts` to switch between real PlantNet and mocks.
- [ ] Normalize species key (prefer `taxonId`, else normalized canonical name).
- [ ] Provide manual species/type entry fallback for offline demos.
- ✅ **Done when**: Photo (or mock) returns `{canonicalName, commonName?, taxonId?, score}`.

## Phase 3 — Policy Generation (ChatGPT)
- [ ] Implement `services/policy/chatgpt.ts` with strict JSON prompt template.
- [ ] Validate responses against schema, clamp values, retry once if invalid.
- [ ] Seed default policies per type (succulent, semi-succulent, tropical, fern).
- [ ] Add validators/clamps in `core/logic/policySchema.ts`.
- ✅ **Done when**: Cache miss yields valid `SpeciesProfile` or safe default.

## Phase 4 — Orchestration Flows
- [ ] Build `core/orchestration/createPlantFlow.ts` for end-to-end add flow.
- [ ] Build `core/orchestration/cacheFlow.ts` with TTL logic (180 days) and `forceRefresh` support.
- ✅ **Done when**: Flow persists plant with species + policy, reusing cache when available.

## Phase 5 — UI (Thin Pass)
- [ ] Add navigation with Home, AddPlant, Settings screens.
- [ ] Implement AddPlant flow (photo picker → candidates → confirm → createPlantFlow).
- [ ] Implement Home (empty state or PlantCard with summary).
- [ ] Implement Settings (mock/real toggles, clear cache/data).
- ✅ **Done when**: Plant added via photo appears on Home with policy summary.

## Phase 6 — Errors, Fallbacks & Resilience
- [ ] Handle PlantNet failures with manual entry flow.
- [ ] Handle ChatGPT failures with seeded defaults and `source: "seed"`.
- [ ] Gracefully handle network timeouts/user cancels without partial saves.
- [ ] Ensure no photos are ever sent to ChatGPT.
- ✅ **Done when**: Unhappy paths yield usable plant card or clear message.

## Phase 7 — QA & Validation
- [ ] Unit test policy validation/clamping and cache TTL behavior.
- [ ] Smoke test repeat species add hits cache (no ChatGPT call).
- [ ] Confirm schema adherence (notes ≤2 strings; thresholds 0–60%).
- ✅ **Done when**: Tests pass and manual verification confirms cache reuse + schema integrity.

## Phase 8 — Demo Readiness
- [ ] Seed script for Peperomia "Hope" example in cache.
- [ ] Document demo script in README.
- [ ] Add `assets/mocks/` photos for offline demo.
- ✅ **Done when**: Clean demo runs in mock or real mode without additional setup.

## Phase 9 — Documentation & Handoff
- [ ] Update `PROJECT_BRIEF.md` with any prompt tweaks.
- [ ] Document API contracts in `docs/API_CONTRACTS.md`.
- [ ] Capture operations guide in `docs/OPERATIONS.md` (env setup, flags, mock/real switching).
- ✅ **Done when**: Teammate can clone repo and reproduce demo in ≤10 minutes.
