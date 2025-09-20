# Smart Plant – MVP Snapshot

## Purpose
Smart Plant helps owners capture a plant photo, identify the species, and receive concise watering guidance that can be referenced offline. The MVP keeps scope tight so we can validate the flow end-to-end without hardware integrations.

## Core Capabilities
- Photo-based species identification via the PlantNet API (with a manual fallback when offline).
- Cache-first profile lookup with 180-day TTL to avoid redundant policy generation.
- Moisture-focused watering policy generation through ChatGPT (text-only prompts, strict JSON schema).
- Lightweight store persisted locally so the home dashboard can surface plant cards with one-line watering summaries.

## Guardrails & Constraints
- Never send photos to ChatGPT—only PlantNet receives user images.
- Always cache species policies keyed by PlantNet `taxonId` (or normalized name) and reuse them on repeats.
- Validate and clamp every policy response to the shared JSON schema; fall back to seeded defaults by plant type if ChatGPT fails.
- Keep modules decoupled so future hardware/sensor integrations can plug into the existing flows.

## Definition of Done (MVP)
1. Adding a plant produces an identified species, validated policy, and persisted plant record.
2. The home screen lists saved plants with photo, species/common name, and a short watering summary.
3. Re-adding the same species reuses the cached profile (no additional ChatGPT call).
4. Mock mode works fully offline for demos, and real mode uses provided API keys when available.
