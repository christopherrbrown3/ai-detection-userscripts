# Multi-site userscript architecture

One installation runs one site adapter. The combined artifact includes the shared detector, runtime, bootstrap, and each implemented adapter; it has no runtime loader or remote dependency. Optional targeted builds use the same sources and retain their original installation identities.

## Source and build ownership

| Source | Responsibility |
| --- | --- |
| `src/platforms/registry.json` | Stable IDs, host ownership, distribution names, modules, support status, layout coverage, route exclusions |
| `src/bootstrap.js` | HTTPS/top-frame dispatch, adapter validation, duplicate coordination, controller ownership |
| `src/platforms/*.js` | Site-specific candidate ownership, text extraction, post/reply classification, badge placement |
| `src/runtime.js` | Structural extraction helpers, scheduling, cache, settings, accessible UI, lifecycle and cleanup |
| `src/detector.js` | Shared normalization, cue semantics, spans, language/sample states, diagnostic model selection |
| `models/default-models.json` | Diagnostic models, thresholds, feature-schema metadata |
| `scripts/build_userscripts.py` | Deterministic distributions, metadata and supported-site documentation |
| `package.json` | Product version, checked against both lockfile version fields |

The build scopes each adapter inside its own factory. Repeated `createPlatformAdapter` declarations cannot collide. Dispatch uses the same host data as generated `@match` metadata, including domain-boundary wildcard matching. Only the selected factory executes. Unsupported hosts and subframes return before storage access, observers, or injected UI.

Model keys remain `<platform-id>:<post|comment>`. Targeted bundles include only their platform and shared default model entries. A site without a model uses the existing cue rules, and Technical details identifies the diagnostic model as unavailable. Platform support does not establish authorship accuracy.

## Registry schema (version 1)

`bundle` declares the canonical `name`, `description`, and `.user.js` `output`. Each `sites` entry requires:

| Field | Contract |
| --- | --- |
| `id` | Unique stable lowercase ID; also the storage/model identity |
| `name`, `scriptName`, `description` | Display name, stable manager installation name, single-line description |
| `module` | Existing `.js` filename within `src/platforms/` |
| `output` | Unique safe `.user.js` filename |
| `hosts` | Nonempty array of exact hosts or `*.domain`; HTTPS is fixed by the builder |
| `status` | `stable`, `experimental`, or `planned` |
| `capabilities` | Array of verified layout labels, published in the generated coverage table |
| `excludedPaths` | Array of route prefixes, or `[]`; `/messages` excludes itself and descendants, not `/messages-other` |

The builder rejects duplicate IDs, output names or script names, unsafe/missing modules, invalid metadata/hosts/routes, cross-site host overlap, and inconsistent release versions. Host overlap within one adapter is allowed to preserve existing match identities. Planned entries are excluded from artifacts and dispatch; keep integrations without an implemented module in issues rather than adding permission placeholders. Experimental integrations are included but start disabled until enabled on that origin.

`--list` reports generated userscripts for tests. `--check` validates every `.user.js`, every metadata-only companion, and `docs/supported-sites.md`. Never edit generated files directly. Compatibility downloads must remain restricted to their existing sites; removing them requires a separate migration decision.

## Adapter contract

The JSDoc contract lives in `src/bootstrap.js`. A factory must be side-effect-free: it must not scan the page, attach observers/listeners, access storage, or allocate timers. It returns:

- `id`, `name`, `postSelector`, `commentSelector`: stable identity and valid nonempty selectors.
- Optional `kindForElement(element)`: returns `post` or `comment`. Without it, matching `commentSelector` determines comment status.
- `isTopLevel(element, kind)`: establishes ownership, avoiding nested quoted-post duplication while permitting independently owned replies.
- `extractContent(element, kind)`: returns `{text, excluded: {quotes, code}, host?}` with author-owned text, nonnegative integer exclusion counts, and an optional placement hint. Preserve structural boundaries with `aiHeuristicReadContent`. Null/empty content removes an old badge; material consisting solely of exclusions can be shown as unassessed.
- `placeBadge(element, badge, kind, content)`: attaches the provided badge without modifying source text or taking over other cards.
- Optional `observedAttributes`: candidate-affecting attribute names in addition to `lang`, `class`, `role`, `data-testid`, and `slot`.
- Optional `supportsUrl(URL)`: additional route eligibility, combined with registry exclusions.

There is no arbitrary lifecycle hook yet: existing integrations need only route eligibility and observed attributes. If a later integration needs additional resources, extend the runtime-owned contract with explicit cleanup and tests before adding hooks. Adapters must not fork detector rules, scheduling, settings, or UI.

Invalid adapters fail before runtime startup. Candidate extraction/placement failures remove stale/partial UI, log one content-free warning per phase, and allow the queue to continue. Partial startup resources are released on failure.

## Runtime lifecycle

An active controller owns one body mutation observer, one near-viewport observer when available, one shallow document-root observer, and a one-second URL/body-reference timer. The timer never scans the feed and does not patch page-world history methods. `popstate`, `hashchange`, and `pageshow` also trigger route checks. Body/head replacement restores owned styles and controls; route changes discard old work and cache state.

Candidates approaching within 400 pixels of the viewport are queued. A flush yields after eight candidates or approximately eight milliseconds; one expensive candidate can exceed that time. Mutations target affected owners/new subtrees. Cached analysis is bounded at 128 entries and is scoped to the current site, settings, and embedded model. Identical extraction avoids recomputation; edits invalidate it; diagnostic scoring remains deferred.

Disabling analysis or entering an excluded route removes badges, closes details, clears queues/cache/records, and disconnects analysis observers. A settings launcher and minimal route/root machinery remain so the user can return. Re-enabling resumes analysis with fresh state. `stop()` is terminal and idempotent: it also releases listeners, timers, styles, settings UI, and ownership. Re-running bootstrap after stop creates a fresh controller. No controller is exported to page globals in production.

## Settings and coexistence

Settings retain `ai-heuristic:<platform-id>:settings:v2` in origin-local storage. Known fields are validated; unknown fields and legacy sensitivity survive writes. `enabled` is additive. Invalid or denied storage uses in-memory defaults. Origins remain independent, including X/Twitter aliases and Reddit subdomains.

Compatible bundles coordinate through a DOM marker and synchronous DOM events, which work across the isolated Chromium worlds tested for this release. The newest semantic product version wins; combined wins a version tie. The loser tears down all owned resources. Stale markers with no live listener are reclaimed. A mixed-installation hint recommends retaining the combined installation. The marker is cooperative coordination, not a security boundary against the host page.

v0.4 and earlier do not participate. New code detects their unowned style/badge markers, suspends its own analysis, and gives migration guidance. It cannot stop old observers or change Userscripts manager settings. Disable old scripts and refresh to complete migration. See [migration and rollback](migration.md) and [verification limits](consolidation-validation.md).
