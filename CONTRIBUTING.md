# Contributing

Bug fixes and research-backed detector improvements are welcome.

1. Edit shared code in `src/`; do not hand-edit generated root userscripts.
2. Add or update a regression test. DOM selector changes need sanitized fixtures exercised through both generated distributions. New sites follow the [adapter checklist and template](docs/adding-sites.md).
3. Detection-feature changes should include an ablation or held-out benchmark result and a bias/FPR discussion.
4. Run the complete local verification described in the README.
5. Change product versions in `package.json` and `package-lock.json` together; keep detector/model schema versions separate.
6. Rebuild the userscripts and ensure `python3 scripts/build_userscripts.py --check` passes.

Never commit datasets containing private, scraped-without-permission, or personally identifying text.

Preserve targeted download identities and existing settings keys. Record supported routes, permission changes, actual browser/manager checks, and any waived verification. Do not claim support for a site merely because its host was registered. See [architecture](docs/architecture.md) and [migration](docs/migration.md).
