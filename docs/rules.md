# Rule authoring

SEO Auditor rules are deterministic functions over persisted crawl facts. The crawler gathers evidence; rules interpret that evidence. Rules must not perform network requests or mutate crawl state.

## Stable IDs

Every rule has a stable lowercase namespaced ID, for example `title.missing` or `indexability.noindex`.

Rule IDs are persistent data keys. Do not rename an existing ID merely to improve wording. Human-facing names and descriptions may evolve independently.

`RuleRegistry` rejects duplicate IDs and IDs that are not namespaced. Registry order is execution order so the same page facts and rule set produce findings in a deterministic order.

## Findings

A finding inherits its rule's ID, severity and category. `RuleEngine` validates these invariants and fails fast if a rule returns inconsistent metadata. Evidence must be deterministic, JSON-serializable data that is useful to the API and UI, such as a count, observed value or relevant URL.

A rule returning no findings means that the supplied page facts did not trigger that rule. It does not mean that the crawler failed to collect the page.

## Testing

Every new rule requires deterministic tests covering both triggering and non-triggering inputs where practical. Engine and registry behavior is tested separately from individual SEO rules.

## v0.3 direction

The v0.3 rule-engine milestone will build on this contract with production technical SEO rules, persisted findings, scoring integration and API/dashboard presentation. Site-specific behavior belongs in optional rule packs rather than the core engine.

## v0.3 Slice 2: core technical SEO rules

The core rule set now consumes crawler evidence directly for HTTP status, redirects, meta robots, X-Robots-Tag and canonicals. Findings include deterministic evidence suitable for persistence, API responses and later dashboard explanations. Metadata and H1 checks also distinguish missing values from present-but-problematic values so a page is not penalised twice for the same absence.

Current thresholds are intentionally deterministic defaults: title 30–60 characters and meta description 70–160 characters. They are rule-engine defaults rather than claims about guaranteed search-result truncation and can become configurable policy in a later release.
