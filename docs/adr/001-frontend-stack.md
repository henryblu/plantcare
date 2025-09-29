# ADR 001: Frontend Stack Selection

## Status
Accepted

## Context
The Smart Plant experience must run on modern browsers with fast iteration loops, rich developer tooling, and strong TypeScript support. We rely on component-driven UI and need predictable concurrent rendering for latency-sensitive features such as live camera previews and optimistic cache updates. Startup performance is critical because the app is distributed as a lightweight web bundle and potentially wrapped for mobile.

## Decision
We adopt **React 18** paired with **Vite**.

* React 18 delivers concurrent rendering, Suspense for data fetching, and automatic batching, which aligns with our need to show cached plant policies immediately while deferring network calls.
* React's ecosystem (hooks, React Testing Library, community libraries) matches our testing strategy and service abstractions already defined in the project.
* Vite provides a lightning-fast dev server with native ES modules, enabling sub-second hot module replacement for rapid experimentation on UI flows.
* Vite's opinionated yet flexible build pipeline outputs optimized, tree-shaken bundles and handles TypeScript transpilation without heavy configuration, keeping the stack lean and portable.
* The React 18 + Vite pairing is widely supported by our chosen testing tools (Vitest) and linting setup (ESLint + Prettier), minimizing integration friction.

## Consequences
* Developers can iterate quickly with HMR and TypeScript type checking that matches our schema-first approach.
* Production builds stay small, improving perceived performance for on-device usage.
* The community support and documentation for React and Vite reduce onboarding time for new contributors.
* We inherit the need to stay current with React 18's concurrent patterns and Vite plugin updates, but these are acceptable trade-offs for the productivity gains.
