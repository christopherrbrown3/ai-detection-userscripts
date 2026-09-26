# Adding a site

Start with the [adapter template](../templates/platform-adapter.js) and [architecture contract](architecture.md). The executable fourth-adapter example in `tests/fixtures/example-adapter.js` and `tests/build_example.py` demonstrates registry-only integration without changing detector or dispatcher code. Its fault-injection attributes belong only to tests.

1. Inspect representative pages you are authorized to view. Define supported hosts, routes, layouts, and exclusions before coding. Choose a stable lowercase ID that will remain the settings/model identity.
2. Copy the template to `src/platforms/<id>.js`. Replace synthetic selectors with verified ownership and author-text boundaries. Skip unfamiliar layouts, private-message surfaces, composers, unrelated controls, and media-only cards with no suitable text. Handle nested replies and quoted/reposted text explicitly.
3. Add a registry entry with unique installation/output names, verified hosts, `excludedPaths`, and precise capability labels. Start unverified browser integrations as `experimental`; planned integrations should not broaden production permissions.
4. Add synthetic/sanitized fixtures and adapter conformance cases. Run each fixture through the generated combined and targeted bundles. Cover posts/replies, nested ownership, quotes/code, expansion, edits, recycled nodes, empty/unknown cards, custom observed attributes, excluded routes, and extraction/placement failures.
5. Verify dispatch does not instantiate other adapters; settings remain origin/site-local; disabling/re-enabling, teardown, and compatible coexistence work. Test the model-unavailable path unless suitable platform-specific diagnostic weights exist. Do not borrow another site's calibration.
6. Rebuild, run JavaScript/Python suites and `--check`, then exercise the generated build in an isolated browser context, at narrow/desktop widths, with keyboard/dark/high-contrast/reduced-motion settings. Measure scrolling/editing work and check detached candidate cleanup. Record actual browsers/managers and any unverified cases.
7. Update capability labels, troubleshooting, release notes, and permission changes. Promote to `stable` only after documented validation. A rule/model change needs separate accuracy evidence; adding a site does not justify changing shared cue semantics.

## Planned integrations

These sites are **not included in v0.5**. Each should ship as a separate adapter change after its fixtures and browser checks are ready.

| Site | Required discovery and coverage |
| --- | --- |
| Bluesky | Verify web hosts/routes; feed/profile/thread/replies, quote/repost ownership, rich-text links/mentions, embedded cards, recycled items |
| Threads | Verify production domains/redirects; feed/profile/permalink/reply layouts, quoted/reposted text, expansion, supported login states, navigation |
| Facebook | Choose initial feed/profile/permalink/comment/overlay surfaces explicitly; separate shared posts, expansion and nested replies; exclude messaging/composers; treat Groups as additional verified scope |

Use [issue #2](https://github.com/christopherrbrown3/ai-detection-userscripts/issues/2) as the acceptance checklist. Sequence integrations according to access to representative pages and validation readiness.
