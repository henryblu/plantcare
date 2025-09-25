# Storage backends

The plant store now writes through the `StorageAdapter` abstraction so we can swap
persistence layers per platform while keeping the same cache semantics. Two
native-friendly backends are supported out of the box:

| Backend | When to use it | Notes |
| --- | --- | --- |
| **SQLite** (`createSQLiteStorageAdapter`) | Preferred for React Native builds that ship with the SQLite module available. | Persists plants and species cache rows in dedicated tables and keeps schema metadata inside the `kv_store` table. Supports bulk TTL pruning and future query expansion. |
| **AsyncStorage** (`createAsyncStorageAdapter`) | Lightweight fallback when SQLite is unavailable (Expo Go, prototyping, unit tests). | Stores the same JSON payloads the core store emits and validates schema envelopes before writing. |

The web build continues to rely on the in-memory adapter during tests. A
browser-specific adapter can still be implemented if IndexedDB support is
required; point it at the same schema helpers described below.

## Schema envelopes & validation

Both backends now expect payloads to be wrapped in a versioned envelope:

```
{
  "schemaVersion": 1,
  "plants": [ ... ]
}
```

```
{
  "schemaVersion": 1,
  "entries": {
    "ficus-lyrata": {
      "profile": { ... },
      "ttlDays": 30,
      "refreshedAt": "2024-03-01T00:00:00.000Z",
      "source": "chatgpt"
    }
  }
}
```

`validatePersistedPlantsPayload` and `validatePersistedSpeciesPayload` guard
every write and reject payloads that are missing IDs, TTL metadata, or the
required envelope. This prevents corrupted JSON from reaching SQLite or
AsyncStorage and keeps the plant cache consistent with the core normalisers.

## Schema version metadata

The SQLite adapter records the envelope version in the `kv_store` table using a
`<key>__meta` entry while rows store the per-record JSON payloads. AsyncStorage
serialises the whole object as JSON, so the version travels with the data. When
the store hydrates, it inspects the version and:

* Migrates legacy arrays/objects into the new envelope and re-persists them.
* Drops invalid entries and overwrites the cache with the sanitised state.
* Logs and clears incompatible future versions so we do not mix formats across
  platforms.

## Legacy migration

On first launch after the upgrade the hydrate flow looks for legacy browser
artifacts (plain arrays or entry maps without envelopes). Any legacy payloads
are normalised, logged, and then rewritten using the new schema. If the data is
from a newer schema version that we cannot understand, the store clears the
persisted rows entirely and warns in the console. This ensures React Native and
web builds remain in sync even when they share the same storage namespace.

## Testing

The persistence layer now includes unit tests for both adapters and an
integration test that renders the `PlantCareProvider` against an AsyncStorage
mock. When adding a new backend, mirror these tests so schema validation,
metadata updates, and hydration behaviour stay covered.
