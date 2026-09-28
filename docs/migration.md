# Install, migrate, and roll back

## Move from the three site scripts to the combined script

1. Open Userscripts → Manage → Open Scripts Folder. Copy existing scripts to a backup folder outside the active scripts directory. Keep any locally edited copies; do not overwrite them with a download.
2. Install [AI-Style Cues (Local)](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/ai-style-cues.userscripts.user.js). Version 0.6 includes the existing LinkedIn, X/Twitter, and Reddit permissions plus `www.facebook.com` and `facebook.com`. Facebook analysis remains off until enabled on that origin; Safari may separately request website access. Existing targeted downloads retain their original scopes. No Instagram, Threads, Bluesky, or YouTube hosts are added.
3. Disable the old LinkedIn, X, and Reddit scripts in Userscripts. Alternatively, move their backed-up files outside the active scripts directory. Keep the combined script enabled and grant the extension access to the sites you want to use.
4. Refresh open supported-site tabs. Already-running legacy scripts cannot be stopped merely by replacing files on disk. Confirm one badge per eligible card, preserved comment/hide filters, and a **Style cue settings** button.
5. Open settings, turn **Enable style cues on this site** off, and confirm the badges disappear. Use **Style cues off · Settings** to turn it back on. This works on empty pages or when filters hide every result.

Settings remain at the existing origin-local `ai-heuristic:<platform-id>:settings:v2` key. A renamed script does not reset them. X and Twitter, or Reddit and old Reddit, can have different preferences because they are different origins. There is no cross-origin synchronization. Unknown legacy fields and diagnostic sensitivity survive the new script's writes. Denied storage keeps changes only in the current tab.

Facebook in v0.6 uses local manager storage via `GM.getValue`/`GM.setValue`, with a platform-and-origin key, because the Facebook page-storage preference did not reliably survive. Existing page preferences are imported when still available; normal updates to the same installed filename preserve manager preferences. Userscripts isolates values by script filename, so switching between Facebook-targeted and combined installations may require enabling Facebook again. Existing LinkedIn, X/Twitter, and Reddit migration behavior is unchanged.

New combined/targeted builds coordinate automatically: the newer release wins, and the combined build wins a version tie. Keep only the installation you intend to update. Legacy v0.4 does not coordinate; when detected, the new script pauses its analysis and asks you to disable the older installation and refresh. It cannot change Userscripts settings for you.

## Updates and targeted installations

The combined script checks the version in `ai-style-cues.userscripts.meta.js` and downloads the complete `.user.js`. Metadata-only companions are generated for all builds, but the existing targeted scripts retain their original `.user.js` update URLs and identities. Their downloads never silently acquire other sites' host permissions.

Userscripts 4.8.6 source supports separate metadata/update and download URLs; see the release's [validation report](consolidation-validation.md). Actual automatic-update scheduling, permission prompts, and Safari execution were not exercised for this release. A manual update is always available: back up your current copy, replace it with the relevant generated `.user.js`, and refresh tabs.

Use a targeted installation if you want a separate manager toggle or narrower script permissions for one site. Do not install `.meta.js` files as scripts. Switching distributions is reversible; note the Facebook manager-storage exception above.

## Rollback

1. Disable/remove the combined script from the active directory, retaining a backup if needed.
2. Restore the three previous targeted files from your backup, or install the matching targeted files from a known release commit. Enable only those files in Userscripts.
3. Refresh affected tabs and verify badge counts and filters. v0.4 reads the existing comment/hide/sensitivity fields but ignores the additive `enabled` preference; use the manager toggle to disable that old release.

Do not reset website storage as part of a normal rollback. For automated/local deployment, record commit/version/SHA-256 values and preserve the manager manifest as well as scripts before changing the active directory. Compare the installed bytes with the tested release, and distinguish file/manifest verification from actual browser execution. Restoring the whole manager manifest is appropriate only if it has not acquired unrelated changes since the backup; otherwise use the manager UI to restore the relevant script choices.
