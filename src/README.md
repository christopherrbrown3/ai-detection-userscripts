# Userscript source

The three root-level `.user.js` files are generated, self-contained release artifacts.

- `detector.js` contains the shared sentence parser, observable cue rules, source spans, and diagnostic feature/scoring engine. Default analysis defers full diagnostics until requested.
- `runtime.js` contains structural DOM extraction, viewport/mutation scheduling, bounded caching, settings, accessibility, and highlighted explanations.
- `platforms/` contains only site-specific extraction and badge-placement adapters.
- `../models/default-models.json` is the single model/threshold source.

Rebuild from the repository root:

```bash
python3 scripts/build_userscripts.py
```

CI runs the same command with `--check` to prevent source/runtime drift.
