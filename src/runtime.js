function aiHeuristicTextContent(node) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  if (clone.querySelectorAll) {
    clone.querySelectorAll('[data-ai-heuristic-ui]').forEach((element) => element.remove());
  }
  return String(clone.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
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
  let scanQueued = false;
  let observer = null;

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
      white-space: nowrap;
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
    .ai-heuristic-badge__text { overflow: hidden; text-overflow: ellipsis; }
    .ai-heuristic-meter {
      --aih-meter: #64748b;
      --aih-meter-soft: #f1f5f9;
      align-items: center;
      display: inline-grid;
      gap: 2px;
      grid-template-columns: repeat(6, 8px);
    }
    .ai-heuristic-meter[data-tone="clear"] { --aih-meter: #15803d; --aih-meter-soft: #dcfce7; }
    .ai-heuristic-meter[data-tone="caution"] { --aih-meter: #ca8a04; --aih-meter-soft: #fef9c3; }
    .ai-heuristic-meter[data-tone="alert"] { --aih-meter: #dc2626; --aih-meter-soft: #fee2e2; }
    .ai-heuristic-meter__segment {
      background: var(--aih-meter-soft);
      border: 1.5px solid #cbd5e1;
      border-radius: 2px;
      box-sizing: border-box;
      height: 12px;
      width: 8px;
    }
    .ai-heuristic-meter[data-tone="clear"] .ai-heuristic-meter__segment {
      border-color: var(--aih-meter);
    }
    .ai-heuristic-meter__segment[data-filled="true"] {
      background: var(--aih-meter);
      border-color: var(--aih-meter);
    }
    .ai-heuristic-meter--large {
      gap: 4px;
      grid-template-columns: repeat(6, 22px);
    }
    .ai-heuristic-meter--large .ai-heuristic-meter__segment {
      border-radius: 4px;
      height: 22px;
      width: 22px;
    }
    .ai-heuristic-cue-summary {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .ai-heuristic-cue-summary__label {
      color: var(--aih-text);
      font-size: 15px;
      font-weight: 800;
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
    .ai-heuristic-popover__eyebrow {
      color: var(--aih-muted);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .08em;
      margin: 0 0 3px;
      text-transform: uppercase;
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
    .ai-heuristic-popover__score-row {
      align-items: center;
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }
    .ai-heuristic-popover__score {
      color: var(--aih-accent);
      font-size: 24px;
      font-variant-numeric: tabular-nums;
      font-weight: 780;
      min-width: 54px;
    }
    .ai-heuristic-popover__score small { color: var(--aih-muted); font-size: 11px; font-weight: 650; }
    .ai-heuristic-popover__bar {
      background: var(--aih-panel);
      border-radius: 999px;
      flex: 1;
      height: 8px;
      overflow: hidden;
    }
    .ai-heuristic-popover__bar > span {
      background: linear-gradient(90deg, color-mix(in srgb, var(--aih-accent) 55%, white), var(--aih-accent));
      border-radius: inherit;
      display: block;
      height: 100%;
    }
    .ai-heuristic-popover__summary { color: var(--aih-muted); margin: 0 0 12px; }
    .ai-heuristic-popover__notice {
      background: color-mix(in srgb, var(--aih-accent) 7%, var(--aih-panel));
      border-left: 3px solid var(--aih-accent);
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
    .ai-heuristic-popover__segments { display: grid; gap: 7px; }
    .ai-heuristic-popover__segment {
      background: var(--aih-panel);
      border-radius: 9px;
      display: grid;
      gap: 3px;
      grid-template-columns: 47px 1fr;
      padding: 8px 9px;
    }
    .ai-heuristic-popover__segment strong { color: var(--aih-accent); font-variant-numeric: tabular-nums; }
    .ai-heuristic-popover__segment span { color: var(--aih-muted); font-size: 11px; }
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
    const count = analysis.cueAssessment.families.length;
    if (count === 0) return 'clear';
    if (count <= 3) return 'caution';
    return 'alert';
  }

  function createCueMeter(analysis, large, accessible) {
    const count = analysis.cueAssessment.families.length;
    const total = analysis.cueAssessment.totalFamilies;
    const meter = createElement(
      'span',
      `ai-heuristic-meter${large ? ' ai-heuristic-meter--large' : ''}`
    );
    meter.dataset.tone = cueTone(analysis);
    if (accessible) {
      meter.setAttribute('role', 'meter');
      meter.setAttribute('aria-label', 'AI cue-family matches');
      meter.setAttribute('aria-valuemin', '0');
      meter.setAttribute('aria-valuemax', String(total));
      meter.setAttribute('aria-valuenow', String(count));
      meter.setAttribute('aria-valuetext', `${count} of ${total} cue families matched`);
    } else {
      meter.setAttribute('aria-hidden', 'true');
    }
    for (let index = 0; index < total; index += 1) {
      const segment = createElement('span', 'ai-heuristic-meter__segment');
      segment.dataset.filled = index < count ? 'true' : 'false';
      meter.appendChild(segment);
    }
    return meter;
  }

  function createBadge(analysis) {
    const badge = createElement('button', 'ai-heuristic-badge');
    badge.type = 'button';
    badge.dataset.aiHeuristicUi = '1';
    badge.dataset.aiPlatform = adapter.id;
    badge.dataset.level = analysis.label.level;
    if (!analysis.calibrated) badge.dataset.cueTone = cueTone(analysis);
    badge.setAttribute('aria-haspopup', 'dialog');
    badge.setAttribute('aria-expanded', 'false');
    badge.setAttribute(
      'aria-label',
      analysis.calibrated
        ? `AI style analysis: ${analysis.label.text}. ${analysis.evidence.level} evidence. Open details.`
        : `AI Score: ${analysis.cueAssessment.families.length} of ${analysis.cueAssessment.totalFamilies} cue families matched. ${analysis.cueAssessment.coverage.text}. Open details.`
    );
    badge.title = 'Open local style analysis';
    if (analysis.calibrated) {
      badge.appendChild(createElement('span', 'ai-heuristic-badge__dot'));
      badge.appendChild(createElement('span', 'ai-heuristic-badge__prefix', 'AI'));
      badge.appendChild(createElement('span', 'ai-heuristic-badge__text', analysis.label.text));
    } else {
      badge.appendChild(createElement('span', 'ai-heuristic-badge__prefix', 'AI Score'));
      badge.appendChild(createCueMeter(analysis, false, false));
    }
    badge.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activePopover && activePopover.badge === badge) closePopover(true);
      else openPopover(badge, analysis);
    });
    return badge;
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
        `Cue rubric: ${cues.families.length}/${cues.totalFamilies} families; ${cues.points} weighted points`,
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

    if (modelBundle.metadata && modelBundle.metadata.calibrated) {
      const sensitivityLabel = createElement('label', '', 'Sensitivity');
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Detector sensitivity');
      for (const value of ['conservative', 'balanced', 'aggressive']) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value[0].toUpperCase() + value.slice(1);
        option.selected = settings.sensitivity === value;
        select.appendChild(option);
      }
      select.addEventListener('change', () => saveSettings({ sensitivity: select.value }));
      sensitivityLabel.appendChild(select);
      controls.appendChild(sensitivityLabel);
    }

    const checks = [
      ['analyzeComments', 'Analyze comments and replies'],
      ['hideInsufficient', 'Hide short or unsupported samples'],
      ['hideLow', 'Hide posts with 0/6 cue families']
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
    return ((modelBundle.metadata && modelBundle.metadata.calibrated) && settings.sensitivity !== defaults.sensitivity) ||
      settings.analyzeComments !== defaults.analyzeComments ||
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
    const launcher = createElement('button', 'ai-heuristic-launcher', 'AI settings');
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
    heading.appendChild(createElement('p', 'ai-heuristic-popover__eyebrow', `${adapter.name} · local analysis`));
    const title = createElement('h2', '', 'AI-style signal settings');
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
      'This button remains available while a non-default filter or sensitivity setting is active.'
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
    if (!analysis.calibrated) popover.dataset.cueTone = cueTone(analysis);
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    const popoverId = `ai-heuristic-popover-${Date.now().toString(36)}`;
    popover.id = popoverId;
    badge.setAttribute('aria-controls', popoverId);
    badge.setAttribute('aria-expanded', 'true');

    const header = createElement('div', 'ai-heuristic-popover__header');
    const heading = document.createElement('div');
    heading.appendChild(createElement('p', 'ai-heuristic-popover__eyebrow', `${adapter.name} · local analysis`));
    const title = createElement('h2', '', analysis.calibrated ? analysis.label.text : 'AI cue analysis');
    title.id = `${popoverId}-title`;
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
    const scoreRow = createElement('div', 'ai-heuristic-popover__score-row');
    const canClassify = analysis.calibrated && analysis.evidence.level !== 'insufficient';
    const cueAssessment = analysis.cueAssessment;
    if (analysis.calibrated) {
      const score = createElement(
        'div',
        'ai-heuristic-popover__score',
        canClassify ? String(analysis.signalPercent) : '—'
      );
      if (canClassify) score.appendChild(createElement('small', '', '/100'));
      scoreRow.appendChild(score);
      const bar = createElement('div', 'ai-heuristic-popover__bar');
      const fill = document.createElement('span');
      fill.style.width = canClassify ? `${analysis.signalPercent}%` : '0%';
      bar.appendChild(fill);
      scoreRow.appendChild(bar);
    } else {
      scoreRow.classList.add('ai-heuristic-cue-summary');
      scoreRow.appendChild(createElement('span', 'ai-heuristic-cue-summary__label', 'AI Score'));
      scoreRow.appendChild(createCueMeter(analysis, true, true));
    }
    body.appendChild(scoreRow);
    body.appendChild(createElement(
      'p',
      'ai-heuristic-popover__summary',
      analysis.calibrated
        ? `${analysis.evidence.level[0].toUpperCase() + analysis.evidence.level.slice(1)} evidence. The score ranks surface-style similarity; it is not an authorship probability.`
        : `${cueAssessment.coverage.text}: ${analysis.metrics.wordCount} words and ${analysis.metrics.sentenceCount} sentences. ${cueAssessment.families.length} of ${cueAssessment.totalFamilies} configured cue families matched; this describes observable style, not authorship.`
    ));

    if (!analysis.calibrated) {
      body.appendChild(createElement(
        'div',
        'ai-heuristic-popover__notice',
        'Explainable heuristic: the badge reports the literal number of matched cue families. These patterns also occur in human writing, and AI text can avoid them, so treat the result as review guidance rather than a verdict.'
      ));
    }

    if (analysis.calibrated) {
      const forSection = createElement('section', 'ai-heuristic-popover__section');
      forSection.appendChild(createElement('h3', '', 'Signals increasing the score'));
      appendList(forSection, analysis.positiveDrivers.map((driver) => driver.name), 'No strong positive signal.');
      body.appendChild(forSection);

      const againstSection = createElement('section', 'ai-heuristic-popover__section');
      againstSection.appendChild(createElement('h3', '', 'Signals reducing confidence or score'));
      const against = analysis.negativeDrivers.map((driver) => driver.name).concat(analysis.counterSignals);
      appendList(againstSection, against, 'No notable counter-signal.');
      body.appendChild(againstSection);
    } else {
      const cueSection = createElement('section', 'ai-heuristic-popover__section');
      cueSection.appendChild(createElement('h3', '', 'Cues found'));
      appendList(
        cueSection,
        cueAssessment.families.map((family) => `${family.name} (${family.points} ${family.points === 1 ? 'point' : 'points'}): ${family.detail}`),
        'No configured AI-associated style cue family was found.'
      );
      body.appendChild(cueSection);

      const coverageSection = createElement('section', 'ai-heuristic-popover__section');
      coverageSection.appendChild(createElement('h3', '', 'Evidence coverage'));
      appendList(coverageSection, [
        cueAssessment.coverage.reason,
        `Sample classes use fixed cutoffs: short (<20 words or <2 sentences), long (≥80 words and ≥4 sentences), otherwise standard.`,
        'Topic, facts, first-person voice, and professional polish are not treated as proof either way.'
      ], '');
      body.appendChild(coverageSection);
    }

    if (analysis.calibrated && analysis.segments.length) {
      const segmentSection = createElement('section', 'ai-heuristic-popover__section');
      segmentSection.appendChild(createElement('h3', '', 'Local style segments'));
      const segments = createElement('div', 'ai-heuristic-popover__segments');
      for (const segment of analysis.segments) {
        const row = createElement('div', 'ai-heuristic-popover__segment');
        row.appendChild(createElement('strong', '', `${Math.round(segment.signal * 100)}/100`));
        row.appendChild(createElement('span', '', segment.excerpt));
        segments.appendChild(row);
      }
      segmentSection.appendChild(segments);
      body.appendChild(segmentSection);
    }

    const details = document.createElement('details');
    details.appendChild(createElement('summary', '', 'Technical details'));
    details.appendChild(createElement('div', 'ai-heuristic-popover__technical', technicalText(analysis)));
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
    return (settings.hideInsufficient && (
      analysis.label.level === 'insufficient' ||
      (!analysis.calibrated && ['short', 'unsupported'].includes(analysis.cueAssessment.coverage.level))
    )) || (settings.hideLow && (analysis.label.level === 'low' || analysis.label.level === 'cue-none'));
  }

  function processElement(element, kind) {
    if (!element || element.nodeType !== 1 || !adapter.isTopLevel(element, kind)) return;
    const text = adapter.extractText(element, kind);
    if (!text) return;
    const fingerprint = hashText(`${kind}\n${text}`);
    const previous = records.get(element);
    if (previous && previous.fingerprint === fingerprint && (!previous.badge || previous.badge.isConnected)) return;
    if (previous && previous.badge) previous.badge.remove();
    const analysis = engine.analyze(text, { kind }, settings);
    if (shouldHide(analysis)) {
      records.set(element, { fingerprint, badge: null, analysis });
      return;
    }
    const badge = createBadge(analysis);
    adapter.placeBadge(element, badge, kind);
    records.set(element, { fingerprint, badge, analysis });
  }

  function scanNow() {
    const seen = new Set();
    document.querySelectorAll(adapter.postSelector).forEach((element) => {
      if (seen.has(element)) return;
      seen.add(element);
      const kind = adapter.kindForElement ? adapter.kindForElement(element, 'post') : 'post';
      if (kind === 'comment' && !settings.analyzeComments) return;
      processElement(element, kind);
    });
    if (settings.analyzeComments) {
      document.querySelectorAll(adapter.commentSelector).forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        processElement(element, 'comment');
      });
    }
  }

  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    window.setTimeout(() => {
      scanQueued = false;
      scanNow();
    }, 180);
  }

  function resetAndRescan() {
    closePopover(false);
    document.querySelectorAll(`.ai-heuristic-badge[data-ai-platform="${adapter.id}"]`).forEach((badge) => badge.remove());
    records = new WeakMap();
    scheduleScan();
  }

  function start() {
    injectStyles();
    syncSettingsLauncher();
    scanNow();
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('click', (event) => {
      if (activePopover && !activePopover.node.contains(event.target) && event.target !== activePopover.badge) {
        closePopover(false);
      }
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activePopover) closePopover(true);
    });
    window.addEventListener('resize', () => closePopover(false), { passive: true });
  }

  function stop() {
    if (observer) observer.disconnect();
    closePopover(false);
    document.querySelectorAll(`.ai-heuristic-badge[data-ai-platform="${adapter.id}"]`).forEach((badge) => badge.remove());
    document.querySelectorAll(`.ai-heuristic-launcher[data-ai-platform="${adapter.id}"]`).forEach((button) => button.remove());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  return {
    scanNow,
    resetAndRescan,
    stop,
    getSettings: () => ({ ...settings }),
    getAnalysis: (element) => records.get(element) && records.get(element).analysis,
    engine
  };
}
