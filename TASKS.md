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

* [ ] **Species cache**
  * [ ] Key: `taxonId` if present; else normalized `canonicalName` (lowercase).
  * [ ] Value: `SpeciesProfile` (includes `policy`, `source`, `ts`, `ttlDays`).
  * [ ] TTL default: 180 days; refresh on `forceRefresh`.

* [ ] **Plant object store**
  * [ ] Save: `photoUri`, `species {canonical, common, taxonId}`, `type`, `policy`, `createdAt`.
  * [ ] Storage: local (web: IndexedDB/localForage; later RN: AsyncStorage).

* [ ] **Schema enforcement**
  * [ ] Validate ChatGPT JSON against `MoisturePolicy` + `SpeciesProfile` schemas.
  * [ ] Clamp to sane bounds (e.g., moisture 0-60%, hysteresis 0-10, notes <= 2).

**DoD:** Re-adding the same species does not hit ChatGPT; invalid payloads never persist.

---

## Phase 3 - Minimal navigation (tabs) + tidy UI

**Goal:** Keep it simple but organized.

* [ ] **Tabs**
  * [ ] **Home**: list of saved plants; "Add plant" CTA.
  * [ ] **Settings**: mock/real toggles, clear cache/data, about/version.

* [ ] **Home**
  * [ ] Plant card: photo, species/common, one-line policy (e.g., "Mostly dry 2-3 days; water when <12%").
  * [ ] Empty state: illustration + "Add your first plant".

* [ ] **Add Plant**
  * [ ] Stepper: Photo -> Candidates -> Confirm (optional nickname, type if manual).
  * [ ] Show confidence badge; route to Phase 1 low-confidence flow if needed.

**DoD:** Two clean tabs; core add/display flows unaffected.

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
* [ ] 2 Local cache + schema enforcement
* [ ] 3 Tabs + tidy UI
* [ ] 4 Service boundaries (portable)
* [ ] 5 Safe demo mode (rate limits, keys)
* [ ] 6 (Deferred) RN shell
* [ ] 7 (Deferred) Accounts concept

---


