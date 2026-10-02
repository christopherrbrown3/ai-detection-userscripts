# YouTube scope and validation — v0.7.0

Validated on October 2, 2026. YouTube is experimental and disabled by default. Enable **Style cues off · Settings → Enable style cues on this site** on `www.youtube.com`. One combined installation supports the initial desktop text surfaces; a generated YouTube-only installation uses the same sources.

## Supported text and boundaries

| Surface | Ownership and extraction |
| --- | --- |
| Watch description | One `ytd-watch-metadata` owner inside the active `ytd-watch-flexy`. Read exactly one `ytd-text-inline-expander#description-inline-expander`: prefer its populated `#expanded yt-attributed-string`, otherwise its `yt-attributed-string#attributed-snippet-text`. Exclude the title. Never concatenate preview and full text. |
| Comments and replies | Independently owned `ytd-comment-view-model` or legacy `ytd-comment-renderer` inside `ytd-comments`. Read exactly one owned `yt-attributed-string#content-text` or `yt-formatted-string#content-text`. Nested replies cannot contribute to their parent. |
| Channel Posts and post permalinks | One `ytd-backstage-post-renderer` inside `ytd-browse`, with exactly one owned formatted/attributed `#content-text`. Nested quoted posts are excluded and are not assessed separately. |

Only HTTPS on `www.youtube.com` is matched. Eligible paths are `/watch?v=<video-id>`, `/post/<post-id>`, and channel `/posts` or `/community` paths under handles, `/channel`, `/c`, or `/user`. All other paths are inactive. Production links and the native checks resolve to the canonical `www` host; no bare-host, mobile, Music, Studio, short-link, or wildcard permission is added.

Titles, author metadata, counts, timestamps, recommendation cards, player controls, captions, transcripts, credit/music metadata, channel bios, translated helpers, editors, live chat, Shorts, mini-player content, and unknown custom widgets are omitted. Description extra-content slots are outside the selected body. Authored paragraph/list boundaries and known quotation/code exclusions use the shared reader; the adapter copies the body's whitespace style when reading its detached clone. It never changes the author's text.

Polls remain unscored. Live Safari discovery found that ordinary Posts also contain an empty, hidden `ytd-backstage-poll-renderer` placeholder. The adapter permits that placeholder, while skipping any visible or populated poll. A hidden populated poll is still skipped. Empty/media-only posts and multiple ambiguous body anchors are skipped; there is no whole-card fallback.

The badge is placed after the description/comment expander or text body, outside the clipped text and native controls. The script analyzes rendered text only. It does not click expansion controls, scroll, retrieve captions, fetch APIs, transmit samples, or load remote dependencies.

## Navigation, settings, and detector

YouTube retains the previous page while navigating. An optional adapter contract declares `yt-navigate-start` and `yt-navigate-finish`; the runtime owns both document listeners. Start clears badges, details, queues, records, and analysis observers. Finish rescans eligible content. Watch extraction also requires `ytd-watch-flexy[video-id]` to equal the URL's `v`, preventing a retained old container from being analyzed under the new video ID. Stop and duplicate-runtime retirement release both listeners. Existing adapters do not declare these events.

Settings retain `ai-heuristic:youtube:settings:v2` in origin-local storage, including site enable/disable, comments/replies, hide-short/unassessed, and hide-zero controls. The targeted script uses `@grant none`; the combined script retains its existing Facebook preference grants without adding a new API. No text or analysis is stored.

The compact **AI Score** badge retains six blocks and no redundant numeric cue-count text. Exact counts remain in details and accessible names. Sample/language eligibility and deferred diagnostics use the existing detector. A YouTube diagnostic model is unavailable; no other site's model is substituted. These checks establish extraction and UI behavior, not authorship accuracy.

`src/detector.js` and `models/default-models.json` are unchanged from v0.6.2. Their SHA-256 values are respectively `69b3d13c762081ff3aede3786314a918e500710574ad103e9c775c10fc5a5e65` and `8a2d324631c9180850f54bbd9996a143a569ee7fae30a478a3f113576f2bfdc4`. The research-grounding and evaluation limits remain in [research grounding](research-grounding.md).

## Automated evidence

The final local run passed **167 JavaScript tests**, **12 Python tests**, generated-artifact checks, Python compilation, and whitespace checks. The JavaScript suite includes 28 YouTube cases covering the source, combined, and targeted builds; existing platform regressions also pass.

Fixtures assert exact extracted text, exclusions, kind/platform identity, cue families/spans, sample/language states, placement, missing models, settings/reload, and host/route dispatch. Dynamic cases cover preview-to-full expansion, late replies, edits, removal/recycling, badge recovery, hidden/visible poll transitions, navigation start/finish, video-ID mismatch, and listener teardown. Generic runtime tests continue to cover malformed/denied storage, root replacement, restart, failures, and settings filters.

Reproduce the browser harness with:

```sh
python3 scripts/prepare_youtube_validation.py
```

Run the emitted `output/playwright/validate-youtube.js` function with the Playwright browser tool. Its fixture responses intercept navigation and abort other requests; no live YouTube content is used. The harness injects the actual generated distributions into Chromium isolated worlds under `script-src 'none'; object-src 'none'`.

Chromium **153.0.8010.55** passed:

- Experimental opt-in and four independently owned fixture badges, with no unsafe/ambiguous samples.
- Enter activation, Escape/focus return, desktop/light and 390 × 844 dark layouts, forced colors, and reduced motion. The narrow panel bounds were x=12, y=12, width=368, height=682.
- Navigation-start cleanup, pause until finish, watch replacement, unsupported routes, and channel Posts with empty hidden poll placeholders.
- Combined/targeted coexistence in both injection orders. Exactly one owner retained two mutation observers, one intersection observer, one interval, and two navigation listeners; all counts reached zero on retirement.

The synthetic scroll/edit workload contained 80 comments with four repeated texts. Both distributions produced all 80 badges after scrolling, analyzed four unique texts, and analyzed an offscreen edit only on return to its viewport. Removing 40 comments left no detached tracked nodes; diagnostics remained deferred.

| Measurement | Combined | Targeted |
| --- | ---: | ---: |
| First badge, ms | 36.6 | 36.5 |
| Extractions including one edit | 81 | 81 |
| Analyses including one edit | 5 | 5 |
| Eager diagnostics | 0 | 0 |
| Total queue flush work, ms | 34.1 | 36.7 |
| Longest flush, ms | 2.8 | 3.0 |
| Remaining tracked / detached / cache | 40 / 0 / 5 | 40 / 0 / 5 |

These are single synthetic runs, not timing guarantees or live-feed benchmarks.

## Native Safari evidence

The combined candidate ran through **Safari 27.0 / Userscripts 4.8.6** on public desktop pages while signed out. Native screenshots were inspected locally and are not committed. Structure-only console probes recorded tags, IDs, lengths, counts, and bounds; real post/comment text and account/session data were not saved in fixtures or reports.

| Check | Observed result |
| --- | --- |
| Default and opt-in | The launcher initially showed analysis off; enabling created badges. The preference survived page refresh and a fresh YouTube tab. |
| Watch description | On [the first watch page](https://www.youtube.com/watch?v=S6PqsZ65Mg4), the collapsed sample was 39 words / 2 sentences. Opening **more** populated the full body and changed the badge to a long sample, with one description badge. |
| Watch comments | Modern comments acquired independently placed badges as they approached the viewport. A structure probe saw 20 rendered comments and five nearby comment badges. |
| Channel Posts | On [the channel Posts page](https://www.youtube.com/@Computerphile/posts), recognized text posts acquired one badge each. User-driven **Read more** expansion retained one badge outside the text expander. |
| Post permalink/comments | Opening the native comment link navigated to the post thread with separate post/comment badges. Expanding replies produced their own assessed or unassessed badges; sorting to **Newest** replaced comments and their badges. A probe found one post badge, seven nearby comment badges, and zero duplicate comment badges. |
| Back/forward | Returning from the post permalink to the channel Posts page and forward restored the appropriate badges. |
| Watch-to-watch | Clicking a recommendation with an open analysis panel navigated to [another watch page](https://www.youtube.com/watch?v=QRYzre4bf7I), cleared the old panel, and produced the new description's 26-word / 3-sentence sample. Playback remained usable and was paused after inspection. |
| UI and diagnostics | Compact bars and short/unassessed states were visible in YouTube's dark layout. Probes found zero horizontal badge overflow. Enter reopened a focused badge after Escape. Technical details reported `youtube:post`, no calibration, and an unavailable diagnostic model. |

## Release status and remaining checks

The initial surfaces have live combined-script evidence and generated targeted regression/isolated-browser evidence. YouTube remains experimental. [Issue #8](https://github.com/christopherrbrown3/ai-detection-userscripts/issues/8) remains open for broader native acceptance: signed-in layout variants, actual end-of-video autoplay, native narrow/forced-color/reduced-motion checks, and a YouTube-only Userscripts installation were not verified. Native comment edits and legacy `/community` routes are fixture coverage. A stalled navigation without a finish event remains suspended until a new completed navigation or page refresh.

The v0.7.0 combined artifact adds one host match and preserves existing grants and installation identity. Local deployment retains one active script and a v0.6.2 script/manifest backup in the machine's userscript backup directory, named `2026-10-02-081526-952668-0400-youtube`. Combined artifact SHA-256: `172674d7553e382b7f8894959bc9cf1c086a16f6527e71687ed8cfc5e2829a1b`. CI and merge results are recorded on the pull request and issue.

## Discovery references

Current native markup was the final source for the shipped boundaries. The author's [YT Toolkit implementation](https://greasyfork.org/en/scripts/584307-yt-toolkit/code) also documents the description expander, expanded attributed text, preview, and extra-content boundaries. The author's [YouTube Layout Fix implementation](https://greasyfork.org/en/scripts/532001-youtube-layout-fix/code) demonstrates modern comment text anchors. The [ResizeYoutubePlayerToWindowSize author's navigation-event discussion](https://github.com/Zren/ResizeYoutubePlayerToWindowSize/issues/72) documents document-level navigation events. These are public implementations, not a stable YouTube DOM API or evidence for detection accuracy.
