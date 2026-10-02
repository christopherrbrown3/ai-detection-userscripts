# Troubleshooting

## No badges appear

1. Confirm the script is enabled in Userscripts.
2. In Safari settings, grant the Userscripts extension access to the affected website.
3. Refresh the page after installation or update.
4. Check whether assessed posts with no cues or short/unassessed samples are hidden in the badge settings. The **Style cue settings** button is always available. Confirm **Enable style cues on this site** is on; messaging routes are intentionally inactive.
5. Scroll the post into or near the viewport; offscreen posts wait until they approach it. Short English samples can still show matched cues, with **Short sample** on the badge.

## A badge says “not assessed”

The English cue rules could not establish enough language evidence. The script deliberately distinguishes this from zero matched patterns. Very short English fragments, multilingual text, and text consisting only of quotations or code may receive this status. The details panel explains the reason and reports excluded material.

## Comments or replies are missing

Open the settings launcher or any visible badge, then enable **Analyze comments and replies**. Some sites load comments only after expansion; the content observer will analyze them after insertion.

## A badge shows an old assessment

The runtime queues the affected post after edits, translations, and expansions, and reuses the result only when the extracted content is unchanged. An offscreen edit is analyzed when the post approaches the viewport. If a stale assessment persists, refresh the page and file an issue with the site, page type, Safari version, and a sanitized DOM snippet.

## A badge is duplicated or attached to the wrong text

First check Userscripts for multiple installations. Disable the old targeted scripts if using the combined script, then refresh the tab. Legacy scripts already running in a tab cannot be stopped by replacing their files. See [migration and rollback](migration.md).

Dynamic site markup changes periodically. Please open a [GitHub issue](https://github.com/christopherrbrown3/ai-detection-userscripts/issues) containing:

- site and page type
- Safari and Userscripts versions
- whether the item is a post, comment, reply, repost, or ad
- a screenshot with personal information removed
- a sanitized HTML fixture if possible

Do not include private messages, account data, or text you do not have permission to share.

## A new site has no badges

LinkedIn, X/Twitter, and Reddit are supported; Facebook desktop support is experimental in v0.6 and starts off. On `www.facebook.com`, open **Style cues off · Settings** and enable analysis for that site. Grant Userscripts website access in Safari if the launcher is missing, then refresh. Facebook comments need an owned comment permalink and recognized text body; ambiguous shared cards and unfamiliar layouts are skipped. Mobile hosts, Groups routes, messaging, Stories, Reels, and Marketplace are outside this release. See [Facebook validation](facebook-validation.md).

YouTube desktop support is experimental in v0.7 and also starts off. Enable it through **Style cues off · Settings** on `www.youtube.com`; grant that host access in Safari and refresh if needed. Watch descriptions, comments/replies, and recognized channel Posts are supported. A description may initially contain only its preview; opening **more** lets the script analyze the newly rendered author text. YouTube navigation temporarily removes badges while a new page is loading. Titles, recommendations, polls, Shorts, transcripts, live chat, Music, Studio, and mobile layouts are excluded. See [YouTube validation](youtube-validation.md).

Instagram, Threads, and Bluesky still require their own adapters. See [supported sites](supported-sites.md).

## Reset settings

For Facebook, use **Style cue settings** to restore the defaults: site analysis off, comments/replies on, and both hide filters off. Its preferences live in the userscript manager, so clearing Facebook website storage does not reset them. A manager that lacks `GM.getValue`/`GM.setValue`, or refuses access, shows a persistence notice and uses page/tab preferences instead.

For LinkedIn, X/Twitter, Reddit, and YouTube, open Safari's website-data controls and remove local storage for the affected site, or run this in that site's developer console:

```js
Object.keys(localStorage)
  .filter((key) => key.startsWith('ai-heuristic:'))
  .forEach((key) => localStorage.removeItem(key));
```

Refresh afterward.
