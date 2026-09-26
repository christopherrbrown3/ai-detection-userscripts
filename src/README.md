# Userscript source

The root `.user.js` and `.meta.js` files are generated, self-contained release artifacts: one combined default and three optional targeted builds.

- `detector.js`: shared sentence parser, cue rules, spans, and deferred diagnostic scoring.
- `runtime.js`: structural extraction, scheduling/cache, settings, accessibility, and lifecycle cleanup.
- `bootstrap.js`: adapter contract/validation, dispatch, and cooperative ownership.
- `platforms/registry.json`: single source for hosts, modules, output identities, routes, and coverage.
- `platforms/*.js`: site-specific candidate ownership, extraction, and badge placement.
- `../models/default-models.json`: model/threshold source; product version comes from `../package.json`.

Run `python3 scripts/build_userscripts.py` to regenerate. CI uses `--check` to prevent drift. `--list` discovers all userscript outputs.

Read the [architecture](../docs/architecture.md), [adapter contributor guide](../docs/adding-sites.md), and [validation report](../docs/consolidation-validation.md) before adding a site.
