# Smart Plant – MVP Project Brief

## Overview

Smart Plant is a mobile MVP that helps plant owners create personalized watering guidance.
The app identifies a plant from a photo using the **PlantNet API**, checks a **lightweight local store** for species data, and if missing, queries **ChatGPT** to generate a **moisture-based watering policy**.

The resulting plant profile (species, type, photo, policy) is saved to the user’s store and displayed in a simple dashboard.
**Hardware/sensor integration is out of scope** for this MVP but will be added in future iterations.

---

## Goals

* Capture a plant photo and identify species (PlantNet).
* On cache miss, generate a moisture policy via ChatGPT.
* Persist plant object with concise policy.
* Show plant card with species and one-line watering guidance.
* Keep the architecture lightweight, modular, and extensible for sensor integration later.

---

## Functional Scope

* **Add Plant flow**

  * Take/upload photo → PlantNet identify → select candidate → check cache → if miss, ChatGPT call → build plant object → save.
* **Store**

  * Lightweight in-memory + persistent store (AsyncStorage).
  * Cache species profiles with TTL (180 days).
* **Policy**

  * JSON schema defines target soil moisture state, dry-out window, thresholds, hysteresis, and notes.
  * ChatGPT must return **strict JSON** conforming to schema.
* **UI**

  * Home screen: empty state or plant card(s).
  * Add Plant screen: photo picker, candidate list, confirm form.
  * (Optional) Settings: toggle mock/real APIs, clear cache.

---

## Out of Scope

* Moisture sensor hardware integration.
* Dynamic health scoring.
* Notifications, reminders, or calendar scheduling.
* Multi-plant dashboards beyond one or two demo plants.
* Advanced editing of policies.

---

## Data Models (simplified)

**Plant**

* `id`, `photoUri`, `species {canonical, common, taxonId}`, `type`, `policy`, `createdAt`

**SpeciesProfile**

* `species`, `type`, `policy`, `source`, `ts`, `ttlDays`, `confidence`

**MoisturePolicy**

* `targetState`: `dry | mostly_dry | slightly_moist | consistently_moist`
* `dryoutWindowDays`: `[min,max]`
* `moistureThresholdPct`: `[low,high]`
* `hysteresisPct`: number
* `notes`: ≤2 strings
* `confidence`: 0–1

---

## Key Constraints

* **Privacy:** user photos go only to PlantNet, never to ChatGPT.
* **Caching:** always cache per-species profile to avoid repeated API calls.
* **Fallbacks:** if ChatGPT fails, fall back to seeded defaults by plant type.
* **Validation:** enforce JSON schema for every ChatGPT response; retry once if invalid.
* **Extensibility:** keep flows modular to add sensor integration later.

---

## Guardrails

* Use **PlantNet** for photo ID; never bypass with ChatGPT.
* **ChatGPT receives text only** (species name + type).
* **Strict JSON outputs only**; reject prose.
* Default policies exist for succulent, semi-succulent, tropical, and fern.
* **Cache key:** PlantNet `taxonId` if available, else normalized canonical name.
* **TTL:** 180 days for cached profiles.
* Always degrade gracefully: mock providers available for offline demo.

---

## Success Criteria

* Add a plant → identified species + policy returned and stored.
* Policy is concise, validated JSON, accessible offline.
* Home screen shows plant card with name + one-line watering summary.
* Repeat add of same species uses cached profile (no ChatGPT call).
* Mock mode works without API keys for demo purposes.
