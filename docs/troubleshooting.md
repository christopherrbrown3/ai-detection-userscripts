# Troubleshooting

## No badges appear

1. Confirm the script is enabled in Userscripts.
2. In Safari settings, grant the Userscripts extension access to the affected website.
3. Refresh the page after installation or update.
4. Check whether assessed posts with no cues or short/unassessed samples are hidden in the badge settings. A **Style cue settings** button remains available while a filter is active.
5. Scroll the post into or near the viewport; offscreen posts wait until they approach it. Short English samples can still show matched cues, with **Short sample** on the badge.

## A badge says “not assessed”

The English cue rules could not establish enough language evidence. The script deliberately distinguishes this from zero matched patterns. Very short English fragments, multilingual text, and text consisting only of quotations or code may receive this status. The details panel explains the reason and reports excluded material.

## Comments or replies are missing

Open any visible badge, then enable **Analyze comments and replies**. Some sites load comments only after expansion; the content observer will analyze them after insertion.

## A badge shows an old assessment

Version 0.4 queues the affected post after edits, translations, and expansions, and reuses the result only when the extracted content is unchanged. An offscreen edit is analyzed when the post approaches the viewport. If a stale assessment persists, refresh the page and file an issue with the site, page type, Safari version, and a sanitized DOM snippet.

## A badge is duplicated or attached to the wrong text

Dynamic site markup changes periodically. Please open a [GitHub issue](https://github.com/christopherrbrown3/ai-detection-userscripts/issues) containing:

- site and page type
- Safari and Userscripts versions
- whether the item is a post, comment, reply, repost, or ad
- a screenshot with personal information removed
- a sanitized HTML fixture if possible

Do not include private messages, account data, or text you do not have permission to share.

## Reset settings

Open Safari's website-data controls and remove local storage for the affected site, or run this in that site's developer console:

```js
Object.keys(localStorage)
  .filter((key) => key.startsWith('ai-heuristic:'))
  .forEach((key) => localStorage.removeItem(key));
```

Refresh afterward.
