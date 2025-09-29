# 🪴 Smart Plant – Engineering Guide

## 1. Purpose

This document defines the **software stack, design methodology, and engineering principles** for the Smart Plant project.
It ensures that all contributors follow the same approach, making the system consistent, portable, and maintainable.

---

## 2. Guiding Principles

* **All on device**: No maintained backend servers. Photos go only to PlantNet; ChatGPT receives *text only*.
* **Lean + clear**: Minimal features, robust error handling, simple UX.
* **Cache first**: Species policies are cached locally with TTL (default 180 days).
* **Schema enforced**: ChatGPT must return *strict JSON* matching our schema; invalid responses never persist.
* **Portable by design**: Service boundaries defined so web and mobile apps can share the same logic.

---

## 3. Software Stack

### Frontend

* **Framework:** React 18 (TypeScript)
* **Bundler/Dev Server:** Vite
* **Testing:** Vitest + React Testing Library
* **Styling:** CSS modules + tokens (spacing, colors, typography)

### Data & Storage

* **Local database:** SQLite (via localForage or platform equivalent)
* **Cache TTL:** 180 days default; force refresh supported
* **Schema validation:** Custom validators (policySchema)

### External Integrations

* **Plant Identification:** PlantNet API (via proxy in dev; direct in prod)
* **Policy Generation:** OpenAI ChatGPT (text only; strict JSON enforced)

### Tooling

* **Package manager:** npm
* **Scripts:** `dev`, `build`, `preview`, `test` defined in `package.json`
* **Linting/formatting:** ESLint + Prettier

---

## 4. Design Methodology

* **MVP-first:** Build smallest useful flow (Add Plant → ID → Policy → Save → Display).
* **Service-oriented:** Encapsulate integrations behind providers:

  * `id/plantNet.ts` → identification provider (real + mock)
  * `policy/chatgpt.ts` → policy provider (real + mock)
  * `storage/kv.ts` → abstracted storage (web vs RN)
* **Strict typing:** Domain models (Plant, SpeciesProfile, MoisturePolicy) enforced via TypeScript + runtime validators.
* **Error taxonomy:** All errors mapped to `NETWORK_ERROR | INVALID_IMAGE | API_ERROR | SCHEMA_ERROR`.

---

## 5. Testing & Quality

* **Unit tests:** schema validation, cache TTL logic, stepper navigation.
* **Integration tests:** Add Plant flow (happy path, low-confidence path, error fallback).
* **UI tests:** PlantCard rendering, Settings toggles.
* **Accessibility:** Components must support keyboard navigation and have labels/alt text.

---

## 6. Contribution Rules

* **Branching:** `main` (stable), feature branches (`feature/<name>`).
* **Commits:** Conventional commits style (`feat:`, `fix:`, `docs:`).
* **Reviews:** At least one reviewer approval required.
* **CI checks:** Lint, unit tests, and type checks must pass before merge.

---

## 7. Future-Proofing

* **Mobile prep:** React Native port reuses services/logic; only storage and UI differ.
* **Premium hardware integration:** Device SDKs wrapped in services with the same abstraction model.
* **Accounts (optional later):** Models include optional `ownerId` field for potential sync.
