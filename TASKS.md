# TASKS - Smart Plant MVP (Software-only)

## Guiding principles

* **All on device**: no server you maintain. Photos go only to PlantNet; ChatGPT receives **text only** (species/type).
* **Lean + clear**: minimal features, robust edges, simple UX.
* **Cache first**: species policy is cached locally with TTL (default 180 days).
* **Schema enforced**: ChatGPT must return *strict JSON* matching our schema.

## Current status (Step 5 snapshot)

* Web UI (single page) with style guide.
* Upload photo -> PlantNet identify -> call ChatGPT O4-mini for moisture policy -> display result.
* **Gaps**: weak input validation, no guardrails, no cache, no tabs, no confidence/quality loop.

---

## Phase 0 - Stabilize the existing web flow

**Goal:** Same features, but safe and predictable.

* [x] **Image validation (client-side)**
  * [x] Accept types: `image/jpeg`, `image/png`, `image/webp`.
  * [x] Max size: 8 MB; show friendly error if exceeded.
  * [x] Min dimensions: 512x512; auto-downscale large images to <= 2048 px longest side.
  * [x] Normalize EXIF orientation before upload.

* [x] **PlantNet request guardrails**
  * [x] Reject if no image or invalid MIME.
  * [x] Timeouts (e.g., 15s) with retry x1; clear error UX on failure.
  * [x] Structured errors: `NETWORK_ERROR | INVALID_IMAGE | API_ERROR`.

* [x] **ChatGPT request guardrails**
  * [x] Never send images; send `{canonicalName, commonName?, type?}` only.
  * [x] Enforce strict JSON response; on invalid JSON -> retry once with "JSON only".
  * [x] Fallback to seeded default policy by type if still invalid.

* [x] **UX states**
  * [x] Loading spinners (PlantNet / ChatGPT).
  * [x] Inline errors with "Try again" and "Choose different photo".
  * [x] Success card shows species + one-line policy.

* [x] **Housekeeping**
  * [x] `.env.sample` with `PLANTNET_API_KEY`, `OPENAI_API_KEY`.
  * [x] Feature flags: `USE_MOCK_PLANTNET`, `USE_MOCK_CHATGPT`.
  * [x] Readme: run steps, mock vs real.

**DoD:** Wrong file types/sizes are blocked; failures do not crash; happy path still works.

---

## Phase 1 - Confidence + photo quality loop

**Goal:** Ask for more photos when ID is uncertain.

* [x] **Heuristic**
  * [x] Compute `top1.score` and `top2.score`.
  * [x] Confidence OK if `top1.score >= 0.55` OR `(top1 - top2) >= 0.25`.
  * [x] Otherwise -> "Low confidence" flow.

* [x] **Low-confidence flow**
  * [x] Prompt user to retake/add up to 2 more photos (leaf close-up, whole plant).
  * [x] Re-query PlantNet with combined evidence (if supported) or best of the new shots.
  * [x] If still low: offer manual species entry + type picker, with clear disclaimer.

* [x] **UI**
  * [x] Confidence meter: `High / Medium / Low` (text + small badge).
  * [x] Microcopy with guidance ("Try better lighting; include leaves and stem").

**DoD:** Bad photos lead to helpful prompts; confident IDs move forward without friction.

---

## Phase 2 - Local cache + schema validation

**Goal:** Avoid repeated API calls; keep data consistent.

* [x] **Species cache**
  * [x] Key: `taxonId` if present; else normalized `canonicalName` (lowercase).
  * [x] Value: `SpeciesProfile` (includes `policy`, `source`, `ts`, `ttlDays`).
  * [x] TTL default: 180 days; refresh on `forceRefresh`.

* [x] **Plant object store**
  * [x] Save: `photoUri`, `species {canonical, common, taxonId}`, `type`, `policy`, `createdAt`.
  * [x] Storage: local (web: IndexedDB/localForage; later RN: AsyncStorage).

* [x] **Schema enforcement**
  * [x] Validate ChatGPT JSON against `MoisturePolicy` + `SpeciesProfile` schemas.
  * [x] Clamp to sane bounds (e.g., moisture 0-60%, hysteresis 0-10, notes <= 2).

**DoD:** Re-adding the same species does not hit ChatGPT; invalid payloads never persist.

---

## Phase 3 — Navigation, IA, and Tidy UI (from PoC → App)

**Goals (what changes for the user)**

* Two-tab app: Home and Settings, plus the Add Plant flow.
* Clear, consistent navigation and states; no dead-ends.
* Saved plants visible and readable at-a-glance; adding a plant is guided and safe.
* Local-only; all guardrails from Phases 0/1 remain intact.

### Epic A — Information Architecture & Navigation

#### A.1 Routes & Tabs

**User story:** As a user, I can move between Home and Settings, and start Add Plant from anywhere.

**Tasks**

* [x] Introduce a lightweight router (e.g., file-based or a minimal wrapper) with three routes:
  * `/` → Home
  * `/add` → Add Plant (stepper)
  * `/settings` → Settings
* [x] Implement a top/bottom TabBar (sticky) with icons + labels: Home, Settings. The Add Plant entry point is a prominent CTA on Home (and optional floating button).
* [x] Preserve deep-linkable step state on `/add` via `?step=photo|candidates|confirm`.

**Definition of Done**

* [x] Keyboard/tab focus order is logical.
* [x] URL reflects current screen (including step changes).
* [x] Navigating back/forward preserves state appropriately.

#### A.2 Empty/Loading/Error States

**User story:** As a user, I always see a helpful state—never a blank screen.

**Tasks**

* [x] Home empty state: simple illustration + “Add your first plant” CTA.
* [x] Skeletons: plant list/tiles while loading.
* [x] Inline errors: non-blocking banners with retry for load failures.

**Definition of Done**

* [x] Each screen renders a defined state for: empty, loading, error, content.

### Epic B — Home (Saved Plants)

#### B.1 Plant List & Cards

**User story:** I can scan my plants and see the key care gist.

**Tasks**

* Data source: use the local store (SQLite layer) read.
* PlantCard component shows: photo (or placeholder), canonical/common name, one-line moisture policy summary (e.g., “Mostly dry 2–3 days; water <12%”), and last updated.
* Actions menu (kebab):
  * View details (future)
  * Rename/nickname (optional; simple inline edit)
  * Delete (with confirm modal)
* Basic sort: by `createdAt` desc (default).

**Definition of Done**

* List renders with 10+ items without layout jank.
* Policy strings correctly derived from schema-clamped data.
* Delete is optimistic + undo (toast) or confirmed via modal.

#### B.2 Performance & Accessibility

**Tasks**

* Virtualize the list if >50 items (conditional).
* Alt text rules; cards reachable/operable by keyboard; visible focus ring.

**Definition of Done**

* Lighthouse a11y score ≥ 95 for Home on desktop + mobile widths.

### Epic C — Add Plant (Stepper)

#### C.1 Stepper Flow

**User story:** I can add a plant via photo or manual entry with guidance on confidence/quality.

**Steps**

1. **Photo**
   * Photo picker (existing validation: type/size/dimensions/orientation).
   * Show PlantNet/ChatGPT status chips (from current PoC).
2. **Candidates**
   * List top candidates + Confidence Badge (High/Med/Low).
   * If Low, run Phase 1 loop (ask for up to 2 more photos or manual entry).
3. **Confirm**
   * Show chosen species + policy summary.
   * Optional nickname, type if manual.
   * Save → store plant + navigate to Home (toast: “Plant added”).

**Tasks**

* Extract a reusable Stepper with: `currentStep`, `next`, `back`, `canNext`.
* Persist step data in memory; mirror step in URL (`?step=`).
* Reuse confidence meter and microcopy from Phase 1.

**Guardrails**

* Never send images to ChatGPT (already ensured).
* Retry → fallback seed policy if JSON invalid (already ensured).

**Definition of Done**

* Cancel from any step prompts confirmation and safely exits without orphan data.
* Saving creates a valid Plant record that appears on Home immediately.
* Re-adding same species respects cache (no extra ChatGPT call).

### Epic D — Settings

#### D.1 Feature Toggles & Maintenance

**User story:** I can toggle mock/live, manage local data, and see version info.

**Tasks**

* Toggles:
  * `USE_MOCK_PLANTNET`, `USE_MOCK_CHATGPT` (persisted).
* Maintenance:
  * Clear species/plant cache (separately and combined).
  * View local storage usage (approximate).
* Keys:
  * Inputs for PlantNet/OpenAI keys (dev only); mask values; “Test connection” action (pings proxy/endpoint without sending images).
* About:
  * App/version, build mode, links to README/help.

**Definition of Done**

* Toggling mocks takes effect on next operation (no hard reload required).
* Clearing data shows confirmation and resets Home appropriately.

### Epic E — Visual System & Tidy UI

#### E.1 Design Tokens & Components

**User story:** The app looks consistent and predictable.

**Tasks**

* Extract tokens: spacing scale, radius, typography, elevation, color roles (surface/text/primary/error).
* Core components: Button, Input, Select, Toggle, Tabs, Card, Badge, Banner, Modal, Toast, Skeleton.
* Standardize error + success banners and inline validation text.

**Definition of Done**

* Buttons/inputs behave the same across screens (hover/focus/disabled).
* Dark-mode optional (if trivial via tokens).

### Epic F — State, Errors, and Telemetry (lightweight)

#### F.1 App State Boundaries

**Tasks**

* Contexts:
  * `PlantStoreContext` (list, add, delete).
  * `SpeciesCacheContext` (get, set, TTL checks).
  * `ConfigContext` (flags, keys, endpoints).
* Error taxonomy (reuse existing): `NETWORK_ERROR | INVALID_IMAGE | API_ERROR | SCHEMA_ERROR`.
* Non-invasive console counters (Phase 5 preview):
  * `id_success`, `entered_low_confidence_loop`, `policy_cache_hit`, `policy_cache_miss`.

**Definition of Done**

* No cross-context leakage; each context can be mocked in tests.
* All thrown errors map to user-friendly banners.

### Epic G — Testing & Quality Gates

#### G.1 Unit / Integration

**Tasks**

* Vitest for:
  * Stepper logic (edge/back/cancel).
  * Confidence heuristic paths.
  * Policy schema clamp/validation (already exists—add new cases).
  * Store operations (add/delete/cache TTL).
* Component tests:
  * PlantCard rendering, Settings toggles, Add flow happy + low-confidence.

#### G.2 Accessibility & Visual QA

**Tasks**

* Axe checks in CI for main views.
* Snapshot tests for PlantCard/Stepper with stable tokens.

**Definition of Done**

* CI green with unit + component + a11y checks.
* No unhandled promise rejections in console during normal use.

### Epic H — Migration & Hardening

#### H.1 Storage/Schema Interop

**Tasks**

* Confirm Phase 2 SQLite schema aligns with UI needs:
  * Plant: `id`, `photoUri`, `species {canonical, common, taxonId}`, `type`, `policy`, `createdAt`.
  * SpeciesProfile: `speciesKey`, `policy`, `source`, `ts`, `ttlDays`.
* Add migrations for any field additions (e.g., nickname).
* Add data sanitizers on read (defensive clone, string trims).

**Definition of Done**

* Existing PoC data loads without crashes.
* New fields default safely (no undefined leaks to UI).

### Implementation Order (suggested)

1. A.1 Routes & Tabs
2. E.1 Tokens & core components (enough to style the three screens)
3. B.1 Home list/cards (+ empty/loading/error)
4. C.1 Add Plant stepper (wire to existing PlantNet/ChatGPT flows)
5. D.1 Settings (toggles, clear data, keys)
6. F Contexts consolidation + error taxonomy + light telemetry
7. G Tests & a11y checks
8. H Migration polish

### Acceptance Criteria (Phase 3)

* Two persistent tabs (Home, Settings) + `/add` stepper route.
* Users can add a plant (photo or manual fallback), see confidence, confirm, and save; saved plant appears on Home.
* Home shows readable PlantCards, delete works safely.
* Settings toggles and data management work; keys masked; “Test connection” succeeds/fails clearly.
* All screens have defined empty/loading/error states.
* Accessibility: keyboard navigation works; clear focus; labels/alt text present.
* Tests cover stepper logic, store operations, rendering of key components; CI passes.

### Risks & Mitigations

* Routing state complexity (stepper + URL): keep step data in memory, mirror step param only; on reload mid-flow, resume or safely reset to Photo.
* Local caches desync: centralize reads/writes through `PlantStoreContext` and `SpeciesCacheContext`.
* UI drift: enforce tokens and shared components early; lint for classnames if using utility CSS.

### Concrete tickets (copy/paste into your tracker)

* Router + Tabs: add `/`, `/add`, `/settings`; TabBar with icons/labels; URL sync.
* Tokens + Components: create tokens; Button/Input/Select/Badge/Card/Banner/Modal/Toast/Skeleton.
* Home List: query plants; render PlantCard; empty/loading/error; delete with confirm + toast.
* Add Flow: Stepper shell; Photo → Candidates → Confirm; cancel/back/next guards; save→Home.
* Low-Confidence Loop: reuse Phase 1 logic; additional photos + manual fallback path.
* Settings: toggles (mock flags), clear cache/data, keys form (masked), test connection action, about/version.
* Contexts: `PlantStoreContext`, `SpeciesCacheContext`, `ConfigContext`; unify error mapping.
* Telemetry (console-only): `id_success`, `low_conf_entered`, `cache_hit/miss`; doc where incremented.
* Tests: unit (stepper, schema clamp, store), component (PlantCard, Settings, Add happy/low).
* A11y pass: axe checks, focus order, alt text; Lighthouse ≥95 on Home & Add.
* Migrations/Sanitizers: ensure older data loads; default nickname/type; sanitize strings.

---

## Phase 4 - Service boundaries (prep for mobile later)

**Goal:** Make the code portable to a phone app without rewrites.

* [ ] **Abstract services**
  * [ ] `id/plantNet.ts` (real + mock behind provider).
  * [ ] `policy/chatgpt.ts` (real + mock; strict JSON handling).
  * [ ] `storage/kv.ts` (web: IndexedDB; RN: AsyncStorage later).
  * [ ] `time/clock.ts` (single source of "now" + TZ helpers).

* [ ] **Pure logic**
  * [ ] `policySchema.ts` (validators/clamps) is framework-agnostic.
  * [ ] `createPlantFlow.ts` orchestrates identify -> cache -> policy -> persist.

**DoD:** Swapping web UI for RN screens later requires no changes in services/logic.

---

## Phase 5 - Guarded production mode (still web)

**Goal:** Ship a safe demo that does not leak costs.

* [ ] **Rate limits**
  * [ ] Throttle PlantNet and ChatGPT calls per session (e.g., 5/min).

* [ ] **Key handling**
  * [ ] Keys loaded from env at build time; never logged; no client-side hardcoding in prod build (use proxy if needed).

* [ ] **Analytics (minimal)**
  * [ ] Console-only counters for: successful ID, low-confidence loop entered, policy cache hits/misses.

**DoD:** Demo ready; keys safe; no runaway API calls.

---

## Phase 6 - (Deferred) Mobile app shell

**Goal:** Prepare a thin RN/Expo shell when ready (optional now).

* [ ] **Screens**: Home, Add Plant (camera), Settings.
* [ ] **Camera**: device capture; reuse existing flows/services.
* [ ] **Storage**: swap `storage/kv.ts` to RN backend.
* [ ] **Style**: import tokens to keep visual parity.

**DoD:** Same UX as web; all logic reused.

---

## Phase 7 - (Deferred) Accounts concept

**Goal:** Keep future options open while staying serverless now.

* [ ] Document options: local-only profile vs. optional sync (user's cloud, e.g., iCloud/Drive) vs. managed backend (cost).
* [ ] Keep `ownerId?` field optional on models to ease migration later.

**DoD:** No functional change now; path forward is documented.

---

## Acceptance criteria (MVP cut)

* Add plant -> confident ID or helpful low-confidence loop -> valid policy produced (cached if repeat) -> plant saved -> displayed on Home.
* Photos never go to ChatGPT. ChatGPT responses are always valid JSON or fall back to seeded defaults.
* Errors never crash the app; users see clear, actionable messages.
* Codebase is service-oriented; later mobile app can reuse logic/services as-is.

---

## Non-goals (for this MVP)

* Hardware sensor integration, live moisture readings, notifications/scheduling.
* Cloud accounts or cross-device sync.
* Advanced editing of policies or multi-user collaboration.

---

## Quick checklist (for daily stand-ups)

* [x] 0 Stabilize web flow (validation, errors)
* [x] 1 Confidence heuristic + multi-photo loop
* [x] 2 Local cache + schema enforcement
* [ ] 3 Tabs + tidy UI
* [ ] 4 Service boundaries (portable)
* [ ] 5 Safe demo mode (rate limits, keys)
* [ ] 6 (Deferred) RN shell
* [ ] 7 (Deferred) Accounts concept

---

