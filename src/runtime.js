function aiHeuristicReadContent(node) {
  const excluded = { quotes: 0, code: 0 };
  if (!node) return { text: '', excluded };
  const parts = [];
  const blocks = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  const preserveLines = /pre|break-spaces/.test(window.getComputedStyle(node).whiteSpace);
  function visit(current, preserve, inList = false) {
    if (current.nodeType === 3) {
      parts.push(preserve && !inList ? current.nodeValue : current.nodeValue.replace(/\s+/g, ' '));
      return;
    }
    if (current.nodeType !== 1) return;
    if (current.matches('[data-ai-heuristic-ui], script, style, template, noscript, button, [role="button"]')) return;
    if (current.matches('blockquote, q, [data-testid="quoteTweet"], .update-components-mini-update-v2')) {
      excluded.quotes += 1;
      parts.push('\n');
      return;
    }
    if (current.matches('pre, code')) {
      excluded.code += 1;
      parts.push('\n');
      return;
    }
    if (current.tagName === 'BR') { parts.push(inList ? ' ' : '\n'); return; }
    const block = blocks.has(current.tagName);
    // A list item's own paragraphs stay on its marked line. Nested lists
    // retain separate item boundaries so prose checks cannot reuse list text.
    const boundary = inList && !['LI', 'UL', 'OL'].includes(current.tagName) ? ' ' : '\n';
    if (block) parts.push(boundary);
    if (current.tagName === 'LI') parts.push('- ');
    const whiteSpace = current.style && current.style.whiteSpace;
    const childPreserve = whiteSpace ? /pre|break-spaces/.test(whiteSpace) : preserve;
    current.childNodes.forEach((child) => visit(child, childPreserve, inList || current.tagName === 'LI'));
    if (block) parts.push(boundary);
  }
  visit(node, preserveLines);
  const text = parts.join('').replace(/\u00a0/g, ' ').replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, excluded };
}

function aiHeuristicTextContent(node) {
  return aiHeuristicReadContent(node).text;
}

function startAIHeuristic(platformAdapter, modelBundle) {
  'use strict';

  const adapter = platformAdapter;
  const engine = createDetectorEngine({ platform: adapter.id, modelBundle });
  const storageKey = `ai-heuristic:${adapter.id}:settings:v2`;
  const defaults = {
    sensitivity: 'balanced',
    analyzeComments: true,
    hideInsufficient: false,
    hideLow: false
  };
  let settings = loadSettings();
  let records = new WeakMap();
  let activePopover = null;
  let observer = null;
  let intersectionObserver = null;
  let queueTimer = null;
  let stopped = false;
  let started = false;
  const tracked = new Set();
  const visible = new WeakSet();
  const dirty = new Set();
  const pending = new Set();
  const analysisCache = new Map();
  const candidateSelector = adapter.postSelector + ', ' + adapter.commentSelector;

  const STYLE = `
    .ai-heuristic-badge {
      --aih-accent: #4f46e5;
      --aih-accent-soft: rgba(79, 70, 229, .13);
      --aih-border: rgba(15, 23, 42, .15);
      --aih-bg: #ffffff;
      --aih-text: #172033;
      --aih-muted: #5c667a;
      align-items: center;
      background: var(--aih-bg);
      background: color-mix(in srgb, var(--aih-bg) 94%, var(--aih-accent) 6%);
      border: 1px solid var(--aih-border);
      border-radius: 999px;
      color: var(--aih-text);
      cursor: pointer;
      display: inline-flex;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      font-weight: 650;
      gap: 6px;
      line-height: 1.2;
      margin: 3px 6px;
      max-width: min(310px, 70vw);
      min-height: 25px;
      padding: 3px 9px 3px 7px;
      text-align: left;
      transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
      vertical-align: middle;
      white-space: normal;
      flex-wrap: wrap;
    }
    .ai-heuristic-badge:hover {
      border-color: color-mix(in srgb, var(--aih-accent) 45%, transparent);
      box-shadow: 0 3px 14px rgba(15, 23, 42, .1);
      transform: translateY(-1px);
    }
    .ai-heuristic-badge:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--aih-accent) 35%, transparent);
      outline-offset: 2px;
    }
    .ai-heuristic-badge[data-level="insufficient"] { --aih-accent: #64748b; }
    .ai-heuristic-badge[data-level="uncalibrated"] { --aih-accent: #b45309; }
    .ai-heuristic-badge[data-level="cue-none"] { --aih-accent: #64748b; }
    .ai-heuristic-badge[data-level="cue-one"] { --aih-accent: #2563eb; }
    .ai-heuristic-badge[data-level="cue-multiple"] { --aih-accent: #7c3aed; }
    .ai-heuristic-badge[data-level="low"] { --aih-accent: #475569; }
    .ai-heuristic-badge[data-level="moderate"] { --aih-accent: #2563eb; }
    .ai-heuristic-badge[data-level="strong"] { --aih-accent: #7c3aed; }
    .ai-heuristic-badge[data-level="mixed"] { --aih-accent: #0f766e; }
    .ai-heuristic-badge[data-cue-tone="clear"] { --aih-accent: #15803d; }
    .ai-heuristic-badge[data-cue-tone="caution"] { --aih-accent: #a16207; }
    .ai-heuristic-badge[data-cue-tone="alert"] { --aih-accent: #b91c1c; }
    .ai-heuristic-badge__dot {
      background: var(--aih-accent);
      border-radius: 50%;
      box-shadow: 0 0 0 3px var(--aih-accent-soft);
      flex: 0 0 auto;
      height: 7px;
      width: 7px;
    }
    .ai-heuristic-badge__prefix { color: var(--aih-muted); font-weight: 750; }
    .ai-heuristic-badge__text { overflow-wrap: anywhere; }
    .ai-heuristic-badge__coverage { color: var(--aih-muted); font-weight: 500; }
    .ai-heuristic-badge[data-cue-tone="neutral"],
    .ai-heuristic-popover[data-cue-tone="neutral"] { --aih-accent: #64748b; }
    .ai-heuristic-badge[data-cue-tone="matched"],
    .ai-heuristic-popover[data-cue-tone="matched"] { --aih-accent: #2563eb; }
    .ai-heuristic-popover__result { font-weight: 700; margin: 0 0 8px; }
    .ai-heuristic-popover .ai-heuristic-cues { list-style: none; padding: 0; }
    .ai-heuristic-popover .ai-heuristic-cues > li { margin: 0 0 18px; }
    .ai-heuristic-cue-detail { color: var(--aih-muted); margin: 4px 0 6px; }
    .ai-heuristic-cue-example { color: var(--aih-text); overflow-wrap: anywhere; white-space: pre-wrap; margin: 6px 0; font-size: 12px; }
    .ai-heuristic-cue-example mark { background: #dbeafe; color: #172554; border-radius: 2px; padding: 1px 0; }
    .ai-heuristic-popover ::selection { background: #bfdbfe; color: #172554; }
    .ai-heuristic-popover input { accent-color: #2563eb; }
    .ai-heuristic-popover summary:focus-visible { outline: 2px solid #2563eb; outline-offset: 3px; }
    @media (prefers-color-scheme: dark) {
      .ai-heuristic-cue-example mark { background: #1e3a5f; color: #eff6ff; }
    }
    .ai-heuristic-launcher {
      align-items: center;
      background: #3730a3;
      border: 1px solid rgba(255, 255, 255, .28);
      border-radius: 999px;
      bottom: 14px;
      box-shadow: 0 6px 22px rgba(15, 23, 42, .24);
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      font-weight: 750;
      gap: 6px;
      padding: 7px 10px;
      position: fixed;
      right: 14px;
      z-index: 2147483645;
    }
    .ai-heuristic-launcher:focus-visible { outline: 3px solid rgba(129, 140, 248, .55); outline-offset: 2px; }

    .ai-heuristic-popover {
      --aih-accent: #4f46e5;
      --aih-border: #d8deea;
      --aih-bg: #ffffff;
      --aih-panel: #f6f8fc;
      --aih-text: #172033;
      --aih-muted: #5c667a;
      background: var(--aih-bg);
      border: 1px solid var(--aih-border);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, .22), 0 3px 12px rgba(15, 23, 42, .12);
      color: var(--aih-text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      left: 12px;
      line-height: 1.45;
      max-height: min(680px, calc(100vh - 24px));
      max-width: calc(100vw - 24px);
      overflow: auto;
      overscroll-behavior: contain;
      padding: 0;
      position: fixed;
      top: 12px;
      width: 380px;
      z-index: 2147483646;
    }
    .ai-heuristic-popover[data-level="insufficient"] { --aih-accent: #64748b; }
    .ai-heuristic-popover[data-level="cue-none"] { --aih-accent: #64748b; }
    .ai-heuristic-popover[data-level="cue-one"] { --aih-accent: #2563eb; }
    .ai-heuristic-popover[data-level="cue-multiple"] { --aih-accent: #7c3aed; }
    .ai-heuristic-popover[data-level="low"] { --aih-accent: #475569; }
    .ai-heuristic-popover[data-level="moderate"] { --aih-accent: #2563eb; }
    .ai-heuristic-popover[data-level="strong"] { --aih-accent: #7c3aed; }
    .ai-heuristic-popover[data-level="mixed"] { --aih-accent: #0f766e; }
    .ai-heuristic-popover[data-cue-tone="clear"] { --aih-accent: #15803d; }
    .ai-heuristic-popover[data-cue-tone="caution"] { --aih-accent: #a16207; }
    .ai-heuristic-popover[data-cue-tone="alert"] { --aih-accent: #b91c1c; }
    .ai-heuristic-popover__header {
      align-items: flex-start;
      border-bottom: 1px solid var(--aih-border);
      display: flex;
      gap: 12px;
      justify-content: space-between;
      padding: 15px 16px 13px;
    }
    .ai-heuristic-popover h2 {
      color: var(--aih-text);
      font-size: 16px;
      line-height: 1.25;
      margin: 0;
    }
    .ai-heuristic-popover__close {
      align-items: center;
      background: transparent;
      border: 0;
      border-radius: 8px;
      color: var(--aih-muted);
      cursor: pointer;
      display: inline-flex;
      font-size: 19px;
      height: 30px;
      justify-content: center;
      padding: 0;
      width: 30px;
    }
    .ai-heuristic-popover__close:hover { background: var(--aih-panel); color: var(--aih-text); }
    .ai-heuristic-popover__close:focus-visible,
    .ai-heuristic-popover select:focus-visible,
    .ai-heuristic-popover input:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--aih-accent) 32%, transparent);
      outline-offset: 2px;
    }
    .ai-heuristic-popover__body { padding: 14px 16px 16px; }
    .ai-heuristic-popover__summary { color: var(--aih-muted); margin: 0 0 12px; }
    .ai-heuristic-popover__notice {
      background: color-mix(in srgb, var(--aih-accent) 7%, var(--aih-panel));
      border-radius: 8px;
      color: var(--aih-text);
      margin: 10px 0 13px;
      padding: 9px 10px;
    }
    .ai-heuristic-popover__section { border-top: 1px solid var(--aih-border); margin-top: 13px; padding-top: 12px; }
    .ai-heuristic-popover__section h3 { font-size: 12px; margin: 0 0 7px; }
    .ai-heuristic-popover__section ul { margin: 0; padding-left: 19px; }
    .ai-heuristic-popover__section li { margin: 3px 0; }
    .ai-heuristic-popover__empty { color: var(--aih-muted); margin: 0; }
    .ai-heuristic-popover details { margin-top: 12px; }
    .ai-heuristic-popover summary { color: var(--aih-muted); cursor: pointer; font-weight: 700; }
    .ai-heuristic-popover__technical {
      background: var(--aih-panel);
      border-radius: 9px;
      color: var(--aih-muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      margin-top: 7px;
      padding: 9px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .ai-heuristic-popover__settings {
      display: grid;
      gap: 9px;
    }
    .ai-heuristic-popover__settings label {
      align-items: center;
      color: var(--aih-text);
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .ai-heuristic-popover__settings select {
      background: var(--aih-bg);
      border: 1px solid var(--aih-border);
      border-radius: 8px;
      color: var(--aih-text);
      font: inherit;
      padding: 5px 7px;
    }
    .ai-heuristic-popover__footer {
      color: var(--aih-muted);
      font-size: 10px;
      margin: 13px 0 0;
    }
    @media (prefers-color-scheme: dark) {
      .ai-heuristic-badge {
        --aih-bg: #161b26;
        --aih-text: #edf1f8;
        --aih-muted: #aab4c5;
        --aih-border: rgba(226, 232, 240, .22);
      }
      .ai-heuristic-popover {
        --aih-bg: #151a24;
        --aih-panel: #202735;
        --aih-text: #f2f5fa;
        --aih-muted: #aeb8ca;
        --aih-border: #343e50;
        box-shadow: 0 22px 65px rgba(0, 0, 0, .55);
      }
      .ai-heuristic-badge[data-level="insufficient"],
      .ai-heuristic-badge[data-level="uncalibrated"],
      .ai-heuristic-badge[data-level="cue-none"],
      .ai-heuristic-badge[data-level="low"],
      .ai-heuristic-popover[data-level="insufficient"],
      .ai-heuristic-popover[data-level="uncalibrated"],
      .ai-heuristic-popover[data-level="cue-none"],
      .ai-heuristic-popover[data-level="low"] { --aih-accent: #94a3b8; }
      .ai-heuristic-badge[data-level="moderate"],
      .ai-heuristic-badge[data-level="cue-one"],
      .ai-heuristic-popover[data-level="moderate"],
      .ai-heuristic-popover[data-level="cue-one"] { --aih-accent: #60a5fa; }
      .ai-heuristic-badge[data-level="strong"],
      .ai-heuristic-badge[data-level="cue-multiple"],
      .ai-heuristic-popover[data-level="strong"],
      .ai-heuristic-popover[data-level="cue-multiple"] { --aih-accent: #a78bfa; }
      .ai-heuristic-badge[data-level="mixed"],
      .ai-heuristic-popover[data-level="mixed"] { --aih-accent: #5eead4; }
      .ai-heuristic-badge[data-cue-tone="neutral"],
      .ai-heuristic-popover[data-cue-tone="neutral"] { --aih-accent: #94a3b8; }
      .ai-heuristic-badge[data-cue-tone="matched"],
      .ai-heuristic-popover[data-cue-tone="matched"] { --aih-accent: #60a5fa; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ai-heuristic-badge { transition: none; }
      .ai-heuristic-badge:hover { transform: none; }
    }
    @media (forced-colors: active) {
      .ai-heuristic-badge, .ai-heuristic-popover { border: 1px solid ButtonText; forced-color-adjust: auto; }
      .ai-heuristic-badge__dot { background: ButtonText; box-shadow: none; }
    }
  `;

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return { ...defaults, ...stored };
    } catch (error) {
      return { ...defaults };
    }
  }

  function saveSettings(next) {
    settings = { ...settings, ...next };
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (error) {
      // Storage may be unavailable in private browsing; settings still work for this page.
    }
    syncSettingsLauncher();
    resetAndRescan();
  }

  function injectStyles() {
    if (document.querySelector(`style[data-ai-heuristic-style="${adapter.id}"]`)) return;
    const style = document.createElement('style');
    style.dataset.aiHeuristicStyle = adapter.id;
    style.dataset.aiHeuristicUi = '1';
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function cueTone(analysis) {
    const cues = analysis.cueAssessment;
    return !cues.assessed || cues.coverage.level === 'short' || !cues.families.length ? 'neutral' : 'matched';
  }

  function createBadge(analysis) {
    const badge = createElement('button', 'ai-heuristic-badge');
    const cues = analysis.cueAssessment;
    badge.type = 'button';
    badge.dataset.aiHeuristicUi = '1';
    badge.dataset.aiPlatform = adapter.id;
    badge.dataset.level = analysis.label.level;
    badge.dataset.cueTone = cueTone(analysis);
    badge.setAttribute('aria-haspopup', 'dialog');
    badge.setAttribute('aria-expanded', 'false');
    const label = cues.assessed ? 'Style cues: ' + cues.families.length + ' matched' : 'Style cues: not assessed';
    badge.appendChild(createElement('span', 'ai-heuristic-badge__text', label));
    if (cues.coverage.level === 'short' || !cues.assessed) {
      badge.appendChild(createElement('span', 'ai-heuristic-badge__coverage', cues.coverage.text));
    }
    badge.setAttribute('aria-label', label + '. ' + cues.coverage.text + '. Open details.');
    badge.title = 'Open local style analysis';
    badge.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activePopover && activePopover.badge === badge) closePopover(true);
      else openPopover(badge, analysis);
    });
    return badge;
  }

  function appendCueExamples(parent, text, spans) {
    for (const span of spans.slice(0, 2)) {
      const start = Math.max(0, span.start - 35);
      const end = Math.min(text.length, span.end + 35, span.start + 220);
      const excerpt = createElement('p', 'ai-heuristic-cue-example');
      excerpt.appendChild(document.createTextNode((start ? '…' : '') + text.slice(start, span.start)));
      excerpt.appendChild(createElement('mark', '', text.slice(span.start, Math.min(span.end, end))));
      excerpt.appendChild(document.createTextNode(text.slice(Math.min(span.end, end), end) + (end < text.length ? '…' : '')));
      parent.appendChild(excerpt);
    }
  }

  function appendList(section, items, emptyText) {
    if (!items.length) {
      section.appendChild(createElement('p', 'ai-heuristic-popover__empty', emptyText));
      return;
    }
    const list = document.createElement('ul');
    for (const item of items) list.appendChild(createElement('li', '', item));
    section.appendChild(list);
  }

  function technicalText(analysis) {
    const metrics = analysis.metrics;
    const lines = [
      `Model: ${analysis.modelKey}`,
      `Model calibration: ${analysis.calibrated ? 'held-out sigmoid' : 'none (experimental baseline)'}`,
      `Words: ${metrics.wordCount}; sentences: ${metrics.sentenceCount}`,
      `MATTR-25: ${metrics.mattr25.toFixed(3)}; sentence CV: ${metrics.sentenceLenCV.toFixed(3)}`,
      `Bigram repeat: ${metrics.bigramRepeatRatio.toFixed(3)}; char-trigram repeat: ${metrics.charTrigramRepeatRatio.toFixed(3)}`,
      `Language support: ${metrics.language.state} (${metrics.language.latinRatio.toFixed(2)} Latin-letter share)`
    ];
    if (analysis.calibrated) {
      lines.splice(2, 0,
        `Signal: ${analysis.signal.toFixed(4)} (ranking score; not a probability)`,
        `Thresholds: moderate ${analysis.thresholds.moderate.toFixed(2)}, strong ${analysis.thresholds.strong.toFixed(2)}`
      );
    } else {
      const cues = analysis.cueAssessment;
      lines.splice(2, 0,
        `Cue rubric: ${cues.families.length}/${cues.totalFamilies} families`,
        `Sample class: ${cues.coverage.text} (${cues.coverage.reason})`,
        `Legacy model output: ${analysis.signal.toFixed(4)} (diagnostic only; not used for the badge)`
      );
    }
    return lines.join('\n');
  }

  function createSettingsSection() {
    const section = createElement('section', 'ai-heuristic-popover__section');
    section.appendChild(createElement('h3', '', 'Settings for this site'));
    const controls = createElement('div', 'ai-heuristic-popover__settings');

    const checks = [
      ['analyzeComments', 'Analyze comments and replies'],
      ['hideInsufficient', 'Hide short or unassessed samples'],
      ['hideLow', 'Hide assessed posts with no cues']
    ];
    for (const [key, labelText] of checks) {
      const label = createElement('label', '', labelText);
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(settings[key]);
      input.addEventListener('change', () => saveSettings({ [key]: input.checked }));
      label.appendChild(input);
      controls.appendChild(label);
    }
    section.appendChild(controls);
    return section;
  }

  function filtersAreActive() {
    return settings.analyzeComments !== defaults.analyzeComments ||
      settings.hideInsufficient !== defaults.hideInsufficient ||
      settings.hideLow !== defaults.hideLow;
  }

  function syncSettingsLauncher() {
    const selector = `.ai-heuristic-launcher[data-ai-platform="${adapter.id}"]`;
    const existing = document.querySelector(selector);
    if (!filtersAreActive()) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const launcher = createElement('button', 'ai-heuristic-launcher', 'Style cue settings');
    launcher.type = 'button';
    launcher.dataset.aiHeuristicUi = '1';
    launcher.dataset.aiPlatform = adapter.id;
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openSettingsPopover(launcher);
    });
    document.body.appendChild(launcher);
  }

  function openSettingsPopover(launcher) {
    closePopover(false);
    const popover = createElement('div', 'ai-heuristic-popover');
    popover.dataset.aiHeuristicUi = '1';
    popover.dataset.level = 'moderate';
    popover.setAttribute('role', 'dialog');
    const popoverId = `ai-heuristic-settings-${Date.now().toString(36)}`;
    popover.id = popoverId;
    launcher.setAttribute('aria-controls', popoverId);
    launcher.setAttribute('aria-expanded', 'true');
    const header = createElement('div', 'ai-heuristic-popover__header');
    const heading = document.createElement('div');
    const title = createElement('h2', '', 'Style cue settings');
    title.id = `${popoverId}-title`;
    heading.appendChild(title);
    popover.setAttribute('aria-labelledby', title.id);
    header.appendChild(heading);
    const close = createElement('button', 'ai-heuristic-popover__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close settings');
    close.addEventListener('click', () => closePopover(true));
    header.appendChild(close);
    popover.appendChild(header);
    const body = createElement('div', 'ai-heuristic-popover__body');
    body.appendChild(createElement(
      'p',
      'ai-heuristic-popover__summary',
      'This button remains available while a non-default filter is active.'
    ));
    body.appendChild(createSettingsSection());
    popover.appendChild(body);
    document.body.appendChild(popover);
    activePopover = { node: popover, badge: launcher };
    positionPopover(popover, launcher);
    close.focus({ preventScroll: true });
  }

  function openPopover(badge, analysis) {
    closePopover(false);
    const popover = createElement('div', 'ai-heuristic-popover');
    popover.dataset.aiHeuristicUi = '1';
    popover.dataset.level = analysis.label.level;
    popover.dataset.cueTone = cueTone(analysis);
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    const popoverId = `ai-heuristic-popover-${Date.now().toString(36)}`;
    popover.id = popoverId;
    badge.setAttribute('aria-controls', popoverId);
    badge.setAttribute('aria-expanded', 'true');

    const header = createElement('div', 'ai-heuristic-popover__header');
    const heading = document.createElement('div');
    const title = createElement('h2', '', 'Style cues');
    title.id = popoverId + '-title';
    heading.appendChild(title);
    popover.setAttribute('aria-labelledby', title.id);
    header.appendChild(heading);
    const close = createElement('button', 'ai-heuristic-popover__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close analysis');
    close.addEventListener('click', () => closePopover(true));
    header.appendChild(close);
    popover.appendChild(header);

    const body = createElement('div', 'ai-heuristic-popover__body');
    const cues = analysis.cueAssessment;
    body.appendChild(createElement('p', 'ai-heuristic-popover__result',
      cues.assessed ? cues.families.length + ' matched · ' + cues.coverage.text : 'Not assessed · ' + cues.coverage.text));
    body.appendChild(createElement('p', 'ai-heuristic-popover__summary',
      analysis.metrics.wordCount + ' words · ' + analysis.metrics.sentenceCount + ' sentences or list items. ' + cues.coverage.reason));
    body.appendChild(createElement('p', 'ai-heuristic-popover__notice',
      'These patterns describe writing style and also occur in human writing. They do not establish authorship.'));

    const cueSection = createElement('section', 'ai-heuristic-popover__section');
    cueSection.appendChild(createElement('h3', '', 'Observed patterns'));
    if (!cues.assessed) {
      cueSection.appendChild(createElement('p', 'ai-heuristic-popover__empty', 'English cue rules were not applied to this sample.'));
    } else if (!cues.families.length) {
      cueSection.appendChild(createElement('p', 'ai-heuristic-popover__empty', 'No configured patterns matched. This does not establish human authorship.'));
    } else {
      const list = createElement('ul', 'ai-heuristic-cues');
      for (const family of cues.families) {
        const item = document.createElement('li');
        item.appendChild(createElement('strong', '', family.name));
        item.appendChild(createElement('p', 'ai-heuristic-cue-detail', family.detail));
        appendCueExamples(item, analysis.sourceText, family.spans);
        list.appendChild(item);
      }
      cueSection.appendChild(list);
    }
    body.appendChild(cueSection);
    if (analysis.excluded.quotes || analysis.excluded.code) {
      body.appendChild(createElement('p', 'ai-heuristic-popover__summary',
        'Excluded from analysis: ' + analysis.excluded.quotes + ' quotations and ' + analysis.excluded.code + ' code sections.'));
    }
    if (analysis.calibrated) {
      body.appendChild(createElement('p', 'ai-heuristic-popover__summary',
        'An experimental model is installed. Its diagnostic output is available in Technical details.'));
    }

    const details = document.createElement('details');
    details.appendChild(createElement('summary', '', 'Technical details'));
    const technical = createElement('div', 'ai-heuristic-popover__technical');
    details.appendChild(technical);
    details.addEventListener('toggle', () => {
      if (!details.open || technical.textContent) return;
      const diagnostic = analysis.getDiagnostics ? analysis.getDiagnostics() : analysis;
      technical.textContent = technicalText(diagnostic);
    });
    body.appendChild(details);
    body.appendChild(createSettingsSection());
    body.appendChild(createElement('p', 'ai-heuristic-popover__footer', analysis.disclaimer));
    popover.appendChild(body);
    document.body.appendChild(popover);
    activePopover = { node: popover, badge };
    positionPopover(popover, badge);
    close.focus({ preventScroll: true });
  }

  function positionPopover(popover, badge) {
    const rect = badge.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(380, window.innerWidth - margin * 2);
    popover.style.width = `${width}px`;
    let left;
    if (rect.right + 8 + width <= window.innerWidth - margin) left = rect.right + 8;
    else if (rect.left - 8 - width >= margin) left = rect.left - 8 - width;
    else left = clamp(rect.left, margin, window.innerWidth - width - margin);
    let top = rect.bottom + 8;
    const height = Math.min(popover.scrollHeight, window.innerHeight - margin * 2);
    if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - height - 8);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function closePopover(restoreFocus) {
    if (!activePopover) return;
    const { node, badge } = activePopover;
    node.remove();
    badge.setAttribute('aria-expanded', 'false');
    badge.removeAttribute('aria-controls');
    activePopover = null;
    if (restoreFocus && badge.isConnected) badge.focus({ preventScroll: true });
  }

  function shouldHide(analysis) {
    const cues = analysis.cueAssessment;
    return (settings.hideInsufficient && (cues.coverage.level === 'short' || !cues.assessed)) ||
      (settings.hideLow && cues.assessed && !cues.families.length);
  }

  function kindFor(element) {
    return adapter.kindForElement ? adapter.kindForElement(element) : element.matches(adapter.commentSelector) ? 'comment' : 'post';
  }

  function processElement(element) {
    if (stopped || !element.isConnected) return;
    const kind = kindFor(element);
    if (!adapter.isTopLevel(element, kind) || (kind === 'comment' && !settings.analyzeComments)) return;
    const content = adapter.extractContent(element, kind);
    const { text, excluded } = content;
    const previous = records.get(element);
    if (!text && !excluded.quotes && !excluded.code) {
      if (previous && previous.badge) {
        if (activePopover && activePopover.badge === previous.badge) closePopover(false);
        previous.badge.remove();
      }
      records.delete(element);
      return;
    }
    const cacheKey = kind + '\n' + excluded.quotes + ':' + excluded.code + '\n' + text;
    const fingerprint = hashText(cacheKey);
    if (previous && previous.fingerprint === fingerprint && previous.text === text &&
      (!previous.badge || previous.badge.isConnected)) return;
    if (previous && previous.badge) {
      if (activePopover && activePopover.badge === previous.badge) closePopover(false);
      previous.badge.remove();
    }
    let analysis = analysisCache.get(cacheKey);
    if (!analysis) {
      analysis = engine.analyze(text, { kind, excluded }, settings);
      analysisCache.set(cacheKey, analysis);
      if (analysisCache.size > 128) analysisCache.delete(analysisCache.keys().next().value);
    }
    if (shouldHide(analysis)) {
      records.set(element, { fingerprint, text, badge: null, analysis });
      return;
    }
    const badge = createBadge(analysis);
    adapter.placeBadge(element, badge, kind, content);
    records.set(element, { fingerprint, text, badge, analysis });
  }

  function flushQueue() {
    queueTimer = null;
    if (stopped) return;
    const start = performance.now();
    let count = 0;
    for (const element of pending) {
      pending.delete(element);
      if (!intersectionObserver || visible.has(element)) {
        dirty.delete(element);
        processElement(element);
      }
      count += 1;
      if (count >= 8 || performance.now() - start >= 8) break;
    }
    if (pending.size) scheduleQueue();
  }

  function scheduleQueue() {
    if (stopped || queueTimer !== null) return;
    queueTimer = window.setTimeout(flushQueue, 30);
  }

  function track(element) {
    if (!element.isConnected || !adapter.isTopLevel(element, kindFor(element))) return;
    dirty.add(element);
    if (!tracked.has(element)) {
      tracked.add(element);
      if (intersectionObserver) intersectionObserver.observe(element);
    }
    if (!intersectionObserver || visible.has(element)) {
      pending.add(element);
      scheduleQueue();
    }
  }

  function discover(root) {
    if (root.nodeType !== 1 || root.closest('[data-ai-heuristic-ui]')) return;
    if (root.matches(candidateSelector)) track(root);
    root.querySelectorAll(candidateSelector).forEach(track);
  }

  function isOwnUI(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return Boolean(element && element.closest('[data-ai-heuristic-ui]'));
  }

  function onMutations(mutations) {
    if (stopped) return;
    let removedContent = false;
    for (const mutation of mutations) {
      if (isOwnUI(mutation.target)) continue;
      const changed = [...mutation.addedNodes, ...mutation.removedNodes];
      const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
      const owner = target && target.closest(candidateSelector);
      if (mutation.type === 'childList' && changed.length && changed.every(isOwnUI)) {
        const record = owner && records.get(owner);
        if (record && record.badge && !record.badge.isConnected) track(owner);
        continue;
      }
      if (owner) track(owner);
      mutation.addedNodes.forEach((node) => discover(node));
      if (mutation.removedNodes.length) removedContent = true;
    }
    if (removedContent) {
      for (const element of tracked) {
        if (element.isConnected) continue;
        if (intersectionObserver) intersectionObserver.unobserve(element);
        if (activePopover && element.contains(activePopover.badge)) closePopover(false);
        tracked.delete(element);
        dirty.delete(element);
        pending.delete(element);
      }
    }
  }

  // Explicit synchronous scan for development/tests; live updates are targeted.
  function scanNow() {
    if (stopped) return;
    document.querySelectorAll(candidateSelector).forEach((element) => {
      track(element);
      pending.delete(element);
      dirty.delete(element);
      processElement(element);
    });
  }

  function resetAndRescan() {
    closePopover(false);
    document.querySelectorAll('.ai-heuristic-badge[data-ai-platform="' + adapter.id + '"]').forEach((badge) => badge.remove());
    records = new WeakMap();
    analysisCache.clear();
    tracked.forEach(track);
  }

  function onDocumentClick(event) {
    if (activePopover && !activePopover.node.contains(event.target) && !activePopover.badge.contains(event.target)) closePopover(false);
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && activePopover) closePopover(true);
  }

  function onViewportChange() {
    closePopover(false);
  }

  function start() {
    if (started || stopped) return;
    started = true;
    injectStyles();
    syncSettingsLauncher();
    if (typeof window.IntersectionObserver === 'function') {
      intersectionObserver = new IntersectionObserver((entries) => {
        if (stopped) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target);
            if (dirty.has(entry.target)) pending.add(entry.target);
          } else visible.delete(entry.target);
        }
        if (pending.size) scheduleQueue();
      }, { rootMargin: '400px' });
    }
    discover(document.body);
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['lang', 'class', 'data-testid', 'slot']
    });
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('scroll', onViewportChange, { passive: true });
  }

  function stop() {
    stopped = true;
    if (observer) observer.disconnect();
    if (intersectionObserver) intersectionObserver.disconnect();
    if (queueTimer !== null) window.clearTimeout(queueTimer);
    document.removeEventListener('DOMContentLoaded', start);
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange);
    tracked.clear();
    dirty.clear();
    pending.clear();
    analysisCache.clear();
    closePopover(false);
    document.querySelectorAll('.ai-heuristic-badge[data-ai-platform="' + adapter.id + '"], .ai-heuristic-launcher[data-ai-platform="' + adapter.id + '"]').forEach((badge) => badge.remove());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  return {
    scanNow, resetAndRescan, stop,
    getSettings: () => ({ ...settings }),
    getAnalysis: (element) => records.get(element) && records.get(element).analysis,
    engine
  };
}
