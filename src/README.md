# Userscript source

The three root-level `.user.js` files are generated, self-contained release artifacts.

- `detector.js` contains the shared, DOM-free feature extraction and scoring engine.
- `runtime.js` contains shared settings, rescoring, accessibility, and popover behavior.
- `platforms/` contains only site-specific extraction and badge-placement adapters.
- `../models/default-models.json` is the single model/threshold source.

Rebuild from the repository root:

```bash
python3 scripts/build_userscripts.py
```

CI runs the same command with `--check` to prevent source/runtime drift.
