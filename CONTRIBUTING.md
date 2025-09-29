# Contributing to Smart Plant

Thank you for helping build Smart Plant! This guide documents the minimum steps for setting up your environment, running quality checks, and preparing pull requests.

## 1. Environment Setup

1. Install [Node.js](https://nodejs.org/) **v18 LTS** or later (includes npm).
2. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd plantcare
   npm install
   ```
3. Copy any required environment examples and fill in secrets for local use:
   ```bash
   cp .env.example .env.local
   # populate PlantNet and OpenAI keys as needed
   ```

## 2. Available Scripts

* `npm run dev` – Start the Vite dev server.
* `npm run build` – Generate a production bundle.
* `npm run preview` – Serve the production build locally.
* `npm run test` – Run unit and integration tests via Vitest.
* `npm run lint` – Run ESLint checks.
* `npm run format` – Format code with Prettier (if defined in package.json).

## 3. Testing & Linting Requirements

Before opening a pull request, you must run:

```bash
npm run lint
npm run test
```

Ensure both commands exit with status 0. Add or update tests when modifying behavior, especially around schema validation, caching, or service integrations.

## 4. Commit & Branch Strategy

* Work on feature branches named `feature/<short-description>` (or `fix/`, `docs/` as appropriate).
* Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages (e.g., `feat: add cache TTL enforcement`).
* Rebase on `main` before requesting a review to keep history linear.

## 5. Pull Request Process

1. Ensure your branch is up to date with `main` and all required checks pass locally.
2. Open a PR with a concise title and summary describing **what** changed and **why**.
3. Link related issues or ADRs when applicable.
4. Request review from at least one project maintainer.
5. Address review feedback promptly; update tests and documentation as needed.
6. CI must report green (lint, tests, type checks) before merge. Maintainers will squash-and-merge once approved.

## 6. Code Style & Documentation

* Follow `docs/CODING_GUIDELINES.md` and `docs/STYLE_GUIDE.md` for style conventions.
* Update or add ADRs when architectural choices change.
* Document new public APIs in `docs/API_CONTRACTS.md`.

By contributing, you agree to uphold the project's guiding principles and quality standards described in the Engineering Guide.
