# Smart Plant – Project Overview

## 1. Product Snapshot

### Purpose
Smart Plant helps owners capture a plant photo, identify the species, and receive concise watering guidance that can be referenced offline. The MVP keeps scope tight so we can validate the flow end-to-end without hardware integrations.

### Core Capabilities
- Photo-based species identification via the PlantNet API (with a manual fallback when offline).
- Cache-first profile lookup with a 180-day TTL to avoid redundant policy generation.
- Moisture-focused watering policy generation through ChatGPT (text-only prompts, strict JSON schema).
- Lightweight store persisted locally so the home dashboard can surface plant cards with one-line watering summaries.

### Guardrails & Constraints
- Never send photos to ChatGPT—only PlantNet receives user images.
- Always cache species policies keyed by PlantNet `taxonId` (or normalized name) and reuse them on repeats.
- Validate and clamp every policy response to the shared JSON schema; fall back to seeded defaults by plant type if ChatGPT fails.
- Keep modules decoupled so future hardware/sensor integrations can plug into the existing flows.

### MVP Definition of Done
1. Adding a plant produces an identified species, validated policy, and persisted plant record.
2. The home screen lists saved plants with photo, species/common name, and a short watering summary.
3. Re-adding the same species reuses the cached profile (no additional ChatGPT call).
4. Mock mode works fully offline for demos, and real mode uses provided API keys when available.

---

## 2. Engineering Fundamentals

### Guiding Principles
- **All on device:** no maintained backend servers. Photos go only to PlantNet; ChatGPT receives text only.
- **Lean + clear:** minimal features, robust error handling, simple UX.
- **Cache first:** species policies are cached locally with TTL (default 180 days).
- **Schema enforced:** ChatGPT must return strict JSON matching our schema; invalid responses never persist.
- **Portable by design:** service boundaries defined so web and mobile apps can share the same logic.

### Software Stack
- **Frontend:** React 18 (TypeScript)
- **Bundler/Dev Server:** Vite
- **Styling:** CSS modules + tokens (spacing, colors, typography)
- **Testing:** Vitest + React Testing Library
- **Local database:** SQLite via localForage (or platform equivalent)
- **Cache TTL:** 180 days default with force refresh support
- **Schema validation:** Custom validators (policy schema)
- **Integrations:** PlantNet API for identification, OpenAI ChatGPT for policy generation (text only)
- **Tooling:** npm scripts for `dev`, `build`, `preview`, `test`; ESLint + Prettier for linting/formatting

### Design Methodology
- **MVP-first:** Build the smallest useful flow (Add Plant → ID → Policy → Save → Display).
- **Service-oriented:** Encapsulate integrations behind providers such as `id/plantNet.ts`, `policy/chatgpt.ts`, and `storage/kv.ts`.
- **Strict typing:** Domain models (`Plant`, `SpeciesProfile`, `MoisturePolicy`) enforced via TypeScript and runtime validators.
- **Error taxonomy:** All errors mapped to `NETWORK_ERROR | INVALID_IMAGE | API_ERROR | SCHEMA_ERROR`.

### Testing & Quality
- **Unit tests:** schema validation, cache TTL logic, stepper navigation.
- **Integration tests:** Add Plant flow (happy path, low-confidence path, error fallback).
- **UI tests:** PlantCard rendering, Settings toggles.
- **Accessibility:** Components must support keyboard navigation and include labels/alt text.

### Future-Proofing
- **Mobile prep:** React Native port reuses services/logic; only storage and UI differ.
- **Premium hardware integration:** Device SDKs wrapped in services with the same abstraction model.
- **Accounts (optional later):** Models include optional `ownerId` field for potential sync.

---

## 3. Delivery Roadmap

### Current Status (Step 5 Snapshot)
- Web UI (single page) with style guide.
- Upload photo → PlantNet identify → call ChatGPT O4-mini for moisture policy → display result.
- **Gaps:** weak input validation, no guardrails, no cache, no tabs, no confidence/quality loop.

### Phase 0 – Stabilize the Existing Web Flow
**Goal:** Same features, but safe and predictable.
- **Image validation (client-side):** accept JPEG/PNG/WebP, max 8 MB, minimum 512×512, downscale to ≤2048px, normalize EXIF.
- **PlantNet guardrails:** reject invalid images, 15s timeout with single retry, structured errors.
- **ChatGPT guardrails:** send text-only payload, enforce strict JSON, retry once, fall back to seeded defaults.
- **UX states:** loading spinners, inline errors with retry/different photo options, success card with species + summary.
- **Housekeeping:** `.env.sample` with keys, feature flags for mock toggles, README run steps.

### Phase 1 – Confidence & Photo Quality Loop
**Goal:** Ask for more photos when identification is uncertain.
- **Heuristic:** high confidence if `top1.score ≥ 0.55` or `(top1 - top2) ≥ 0.25`; otherwise trigger low-confidence flow.
- **Low-confidence flow:** prompt for up to two more photos, re-query with combined evidence, offer manual entry if still low.
- **UI:** confidence meter badge and guidance copy.

### Phase 2 – Local Cache & Schema Validation
**Goal:** Avoid repeated API calls and keep data consistent.
- **Species cache:** key by `taxonId` or normalized `canonicalName`, store `SpeciesProfile` with policy, TTL, and refresh support.
- **Plant object store:** persist `photoUri`, species metadata, `type`, `policy`, `createdAt` via local storage abstraction.
- **Schema enforcement:** validate ChatGPT JSON, clamp to sane bounds, block invalid payloads from persisting.

### Phase 3 – Navigation, IA, and Tidy UI
**Goal:** Transition from proof-of-concept to app-level polish.
- **Routes & Tabs:** lightweight router with `/`, `/add`, `/settings`; sticky tab bar; Add Plant CTA accessible from Home.
- **State Coverage:** defined empty/loading/error/content states; skeletons for plant list.
- **Home Experience:** plant list sorted by `createdAt`, PlantCard details, actions (view, rename, delete with confirm/undo).

---

## 4. Contribution Workflow

### Environment Setup
1. Install Node.js v18 LTS or later (includes npm).
2. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd plantcare
   npm install
   ```
3. Copy environment examples and supply secrets:
   ```bash
   cp .env.example .env.local
   # populate PlantNet and OpenAI keys as needed
   ```

### Available Scripts
- `npm run dev` – start the Vite dev server.
- `npm run build` – generate a production bundle.
- `npm run preview` – serve the production build locally.
- `npm run test` – run unit and integration tests via Vitest.
- `npm run lint` – run ESLint checks.
- `npm run format` – format code with Prettier (if configured).

### Quality Gates
Before opening a pull request, run:
```bash
npm run lint
npm run test
```
Ensure both commands exit successfully. Update or add tests when changing schema validation, caching, or service integrations.

### Branching & PRs
- Use feature branches (`feature/<name>` or `fix/`, `docs/`).
- Follow Conventional Commits for messages.
- Rebase on `main` before requesting review.
- Open PRs with concise summaries, link related issues/ADRs, request at least one reviewer, and keep CI green (lint, tests, type checks).

### Documentation Expectations
- Follow `docs/CODING_GUIDELINES.md` and `docs/STYLE_GUIDE.md`.
- Update ADRs when architectural choices change.
- Document new public APIs in `docs/API_CONTRACTS.md`.
- Keep this overview current when roadmap or product assumptions shift.
