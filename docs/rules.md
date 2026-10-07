# Rule authoring

Every rule has a stable lowercase namespaced ID, e.g. `title.missing` or `indexability.noindex`.

Rule IDs are persistent data keys. Do not rename an existing ID merely to improve wording. Human-facing names/descriptions may evolve independently.

Every new rule requires deterministic tests and should return evidence useful to the UI/API.
