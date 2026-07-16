# Contributing

Bug fixes and research-backed detector improvements are welcome.

1. Edit shared code in `src/`; do not hand-edit generated root userscripts.
2. Add or update a regression test. DOM selector changes should include a sanitized fixture.
3. Detection-feature changes should include an ablation or held-out benchmark result and a bias/FPR discussion.
4. Run the complete local verification described in the README.
5. Rebuild the userscripts and ensure `python3 scripts/build_userscripts.py --check` passes.

Never commit datasets containing private, scraped-without-permission, or personally identifying text.
