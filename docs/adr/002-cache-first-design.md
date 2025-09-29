# ADR 002: Cache-First Species Policy Design

## Status
Accepted

## Context
Plant identification and policy generation depend on external services (PlantNet and ChatGPT). Network availability is intermittent, and repeated requests increase latency and API costs. Users revisit plant guidance infrequently, so most information remains valid for months. We also commit to an on-device experience without managed servers, making resilient local storage essential.

## Decision
Implement a cache-first strategy with enforced time-to-live (TTL) values for species policies.

* Species policies and identification metadata are stored locally using SQLite via platform-specific storage adapters.
* Entries default to a **180-day TTL**, matching horticulture guidance refresh cycles. Policies can be manually refreshed when users suspect outdated data.
* Cache lookups drive the UI: the app displays cached policies immediately, then decides whether to revalidate based on TTL expiry or explicit refresh actions.
* TTL enforcement occurs at read time (reject stale entries) and via periodic cleanup tasks to keep storage lean.
* All cache operations pass through typed storage services (`storage/kv.ts`), allowing web and mobile to share logic while swapping implementations.

## Consequences
* Users gain instant access to existing plant care advice even when offline.
* Network calls are minimized, protecting rate limits and reducing third-party dependency risk.
* The TTL boundary creates predictable behavior for stale data and simplifies testing of cache logic.
* We must maintain validators to prevent corrupt or schema-invalid cache entries from persisting, but this aligns with our schema enforcement principle.
