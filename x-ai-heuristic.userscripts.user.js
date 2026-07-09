// Safari Userscripts install:
// 1) Install the Userscripts extension for Safari.
// 2) Open Userscripts -> Manage -> Open Scripts Folder.
// 3) Copy this file into that folder and enable it.
// 4) Visit https://www.linkedin.com/ and refresh.
//
// ==UserScript==
// @name         X AI Content Heuristic (Safari Userscripts)
// @version      0.8.1
// @description  Adds a small AI-likelihood label next to X feed posts (local heuristic only). Safari-optimized for the Userscripts extension.
// @author       christopherrbrown3
// @run-at       document-idle
// @match        https://x.com/*
// @match        https://www.x.com/*
// @match        https://twitter.com/*
// @match        https://www.twitter.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Sensitivity: 'conservative' | 'balanced' | 'aggressive'
  const SENSITIVITY = 'aggressive';
  const DEBUG = false;

  if (DEBUG) console.log('[AI-heuristic] script start');

  const STYLE = `
  .ai-heuristic-badge {
    --ai-low: #0f7a3a;
    --ai-mid: #b45309;
    --ai-likely: #d97706;
    --ai-high: #b42318;
    --ai-certain: #7f1d1d;
    --ai-na: #6b7280;
    --ai-bg: #f7f8fa;
    --ai-text: #1f2937;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 8px;
    margin-left: 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2px;
    line-height: 1;
    border: 1px solid rgba(0,0,0,0.08);
    background: linear-gradient(180deg, #ffffff 0%, var(--ai-bg) 100%);
    color: var(--ai-text);
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 3px 10px rgba(0,0,0,0.04);
    transform: translateY(0);
    transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
    white-space: nowrap;
    max-width: 340px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ai-heuristic-badge:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06);
  }
  .ai-heuristic-badge .ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ai-na);
    box-shadow: 0 0 0 2px rgba(107, 114, 128, 0.12);
  }
  .ai-heuristic-badge .ai-label {
    opacity: 0.7;
    font-weight: 700;
  }
  .ai-heuristic-badge .ai-score {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ai-heuristic-badge .ai-confidence {
    opacity: 0.6;
    font-weight: 700;
  }
  .ai-heuristic-badge {
    position: relative;
    cursor: pointer;
    user-select: none;
  }
  .ai-heuristic-badge[data-level="low"], .ai-heuristic-badge[data-level="unlikely"] {
    border-color: rgba(15, 122, 58, 0.35);
  }
  .ai-heuristic-badge[data-level="low"] .ai-dot, .ai-heuristic-badge[data-level="unlikely"] .ai-dot {
    background: var(--ai-low);
    box-shadow: 0 0 0 2px rgba(15, 122, 58, 0.14);
  }
  .ai-heuristic-badge[data-level="mid"], .ai-heuristic-badge[data-level="possible"] {
    border-color: rgba(180, 83, 9, 0.35);
  }
  .ai-heuristic-badge[data-level="mid"] .ai-dot, .ai-heuristic-badge[data-level="possible"] .ai-dot {
    background: var(--ai-mid);
    box-shadow: 0 0 0 2px rgba(180, 83, 9, 0.14);
  }
  .ai-heuristic-badge[data-level="likely"] {
    border-color: rgba(217, 119, 6, 0.38);
  }
  .ai-heuristic-badge[data-level="likely"] .ai-dot {
    background: var(--ai-likely);
    box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.14);
  }
  .ai-heuristic-badge[data-level="high"], .ai-heuristic-badge[data-level="very"] {
    border-color: rgba(180, 35, 24, 0.35);
  }
  .ai-heuristic-badge[data-level="high"] .ai-dot, .ai-heuristic-badge[data-level="very"] .ai-dot {
    background: var(--ai-high);
    box-shadow: 0 0 0 2px rgba(180, 35, 24, 0.14);
  }
  .ai-heuristic-badge[data-level="certain"] {
    border-color: rgba(127, 29, 29, 0.4);
  }
  .ai-heuristic-badge[data-level="certain"] .ai-dot {
    background: var(--ai-certain);
    box-shadow: 0 0 0 2px rgba(127, 29, 29, 0.14);
  }
  .ai-heuristic-badge[data-level="na"] {
    border-color: rgba(107, 114, 128, 0.35);
  }
  .ai-heuristic-badge[data-level="na"] .ai-dot {
    background: var(--ai-na);
    box-shadow: 0 0 0 2px rgba(107, 114, 128, 0.14);
  }
  .ai-heuristic-badge .ai-tooltip {
    position: relative;
  }
  
  .ai-heuristic-tooltip {
    position: absolute;
    z-index: 99999;
    max-width: 320px;
    min-width: 220px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #111827;
    color: #f9fafb;
    font-size: 11px;
    line-height: 1.4;
    box-shadow: 0 10px 28px rgba(0,0,0,0.25);
    pointer-events: none;
    white-space: pre-line;
  }

`;

  const style = document.createElement('style');
  style.textContent = STYLE;
  (document.head || document.documentElement).appendChild(style);

  const AI_BUZZ = [
    'synergy', 'leverage', 'unlock', 'paradigm', 'disrupt', 'innovative', 'thought leadership',
    'game-changer', 'empower', 'elevate', 'journey', 'mission', 'vision', 'stakeholders',
    'scalable', 'robust', 'strategic', 'amazing', 'incredible', 'excited to announce',
    'thrilled to', 'grateful for', 'honored to', 'humble', 'delighted to share', 'proud to'
  ];

  const HEDGE = [
    'as an ai', 'as a language model', 'i cannot', 'i’m unable', 'i am unable', 'i don’t have access',
    'cannot provide', 'i cannot provide'
  ];

  const TRANSITIONS = [
    'in conclusion', 'overall', 'to sum up', 'moreover', 'furthermore', 'additionally', 'in addition',
    'on the other hand', 'as a result', 'in summary', 'it is important to', 'it is worth noting',
    'at the end of the day', 'in the meantime', 'that said', 'in other words', 'to be clear',
    'to put it simply', 'as such', 'with that in mind'
  ];

  const GENERIC_TEMPLATES = [
    'here’s the thing', "here's the thing", 'let’s dive in', "let's dive in",
    'key takeaways', 'tldr', 'tl;dr', 'in today’s world', "in today's world",
    'here are', "here's how", 'here is how', 'step by step', 'in this post', 'in this thread'
  ];

  const STOPWORDS = [
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'because', 'so', 'of', 'to', 'in', 'on',
    'for', 'with', 'by', 'as', 'at', 'from', 'that', 'this', 'these', 'those', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
    'i', 'me', 'my', 'he', 'his', 'she', 'her', 'not', 'no', 'yes', 'do', 'does', 'did', 'can',
    'could', 'would', 'should', 'may', 'might', 'must', 'will', 'just'
  ];

  // Safari/Tampermonkey Classic may not support Unicode property escapes.
  let EMOJI_RE;
  try {
    EMOJI_RE = new RegExp('[\\p{Extended_Pictographic}]', 'u');
  } catch (err) {
    // Broad fallback for common emoji ranges.
    EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  }

  const STOP_SET = new Set(STOPWORDS);

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function sigmoid(x) {
    if (x >= 20) return 1;
    if (x <= -20) return 0;
    return 1 / (1 + Math.exp(-x));
  }

  function cleanForTokens(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeText(text) {
    return (text || '').replace(/\u00A0/g, ' ').replace(/\r/g, '').trim();
  }

  function stripToken(token) {
    return (token || '').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g, '');
  }

  function evidenceToRank(e) {
    if (e === 'HIGH') return 2;
    if (e === 'MED') return 1;
    return 0;
  }

  function rankToEvidence(r) {
    if (r >= 2) return 'HIGH';
    if (r === 1) return 'MED';
    return 'LOW';
  }

  function formatPercent(p) {
    return `${Math.round(clamp(p, 0, 1) * 100)}%`;
  }

  function isLikelyEnglish(rawText) {
    const t = rawText || '';
    const asciiLetters = (t.match(/[A-Za-z]/g) || []).length;
    const nonAscii = (t.match(/[^\x00-\x7F]/g) || []).length;
    const denom = Math.max(1, asciiLetters + nonAscii);
    const ratio = asciiLetters / denom;
    return { ratio, isEnglishish: ratio >= 0.6 };
  }

  function extractFeatures(rawText, context) {
    const raw = normalizeText(rawText);
    const cleaned = cleanForTokens(raw);
    const lower = cleaned.toLowerCase();

    const rawWords = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
    const tokens = rawWords.map(stripToken).filter(Boolean);
    const normTokens = tokens.map(t => t.toLowerCase()).filter(t => /[a-z0-9]/.test(t));

    const wordCount = normTokens.length;
    const charCount = cleaned.length;

    const lines = (rawText || '').replace(/\r/g, '').split('\n');
    let listMarkerCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const ln = (lines[i] || '').trimLeft();
      if (!ln) continue;
      if (/^(\u2022|-|\*|\d+[\.\)])\s+/.test(ln)) listMarkerCount++;
    }
    const newlineCount = ((rawText || '').match(/\n/g) || []).length;
    const newlineRatio = newlineCount / Math.max(1, (rawText || '').length);

    const sentences = cleaned.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const sentenceLens = sentences.map(s => {
      const ws = s.split(/\s+/).map(stripToken).filter(Boolean);
      return ws.length;
    }).filter(n => n > 0);
    const sentenceCount = Math.max(1, sentenceLens.length || sentences.length || 1);
    const sentMean = sentenceLens.length ? (sentenceLens.reduce((a, b) => a + b, 0) / sentenceLens.length) : 0;
    const sentVar = sentenceLens.length ? (sentenceLens.reduce((a, b) => a + Math.pow(b - sentMean, 2), 0) / sentenceLens.length) : 0;
    const sentStd = Math.sqrt(sentVar);
    const sentenceLenCV = sentMean ? (sentStd / sentMean) : 0;
    const avgSentenceLen = sentMean || (wordCount ? (wordCount / sentenceCount) : 0);

    const uniq = new Set(normTokens);
    const typeTokenRatio = uniq.size / Math.max(1, wordCount);

    const freq = Object.create(null);
    for (let i = 0; i < normTokens.length; i++) {
      const w = normTokens[i];
      freq[w] = (freq[w] || 0) + 1;
    }
    let hapaxCount = 0;
    let top1 = 0;
    for (const k in freq) {
      if (!Object.prototype.hasOwnProperty.call(freq, k)) continue;
      const c = freq[k];
      if (c === 1) hapaxCount++;
      if (c > top1) top1 = c;
    }
    const hapaxRatio = hapaxCount / Math.max(1, wordCount);
    const topWordShare = top1 / Math.max(1, wordCount);

    const bigrams = [];
    for (let i = 0; i < normTokens.length - 1; i++) bigrams.push(normTokens[i] + ' ' + normTokens[i + 1]);
    const bigramSet = new Set(bigrams);
    const bigramRepeatRatio = bigrams.length ? 1 - (bigramSet.size / bigrams.length) : 0;

    const trigrams = [];
    for (let i = 0; i < normTokens.length - 2; i++) trigrams.push(normTokens[i] + ' ' + normTokens[i + 1] + ' ' + normTokens[i + 2]);
    const trigramSet = new Set(trigrams);
    const trigramRepeatRatio = trigrams.length ? 1 - (trigramSet.size / trigrams.length) : 0;

    const starters = [];
    for (let i = 0; i < sentences.length; i++) {
      const ws = sentences[i].split(/\s+/).map(stripToken).filter(Boolean);
      const a = (ws[0] || '').toLowerCase();
      const b = (ws[1] || '').toLowerCase();
      if (a && b) starters.push(`${a} ${b}`);
    }
    const starterSet = new Set(starters);
    const sentenceStarterRepeatRatio = starters.length ? 1 - (starterSet.size / starters.length) : 0;

    let stopHits = 0;
    let numberHits = 0;
    for (let i = 0; i < normTokens.length; i++) {
      const w = normTokens[i];
      if (STOP_SET.has(w)) stopHits++;
      if (/\d/.test(w)) numberHits++;
    }
    const stopwordRatio = stopHits / Math.max(1, wordCount);
    const numberTokenRatio = numberHits / Math.max(1, wordCount);

    let wordLenSum = 0;
    const wordLens = [];
    for (let i = 0; i < tokens.length; i++) {
      const l = tokens[i].length;
      if (!l) continue;
      wordLenSum += l;
      wordLens.push(l);
    }
    const avgWordLen = wordLens.length ? (wordLenSum / wordLens.length) : 0;
    const wlMean = avgWordLen;
    const wlVar = wordLens.length ? (wordLens.reduce((a, b) => a + Math.pow(b - wlMean, 2), 0) / wordLens.length) : 0;
    const wlStd = Math.sqrt(wlVar);
    const wordLenCV = wlMean ? (wlStd / wlMean) : 0;

    const countHits = (phrases) => phrases.reduce((acc, ph) => acc + (lower.includes(ph) ? 1 : 0), 0);
    const buzzHits = countHits(AI_BUZZ);
    const hedgeHits = countHits(HEDGE);
    const transitionHits = countHits(TRANSITIONS);
    const templateHits = countHits(GENERIC_TEMPLATES);

    const exclamations = (cleaned.match(/!/g) || []).length;
    const questions = (cleaned.match(/\?/g) || []).length;
    const commas = (cleaned.match(/,/g) || []).length;
    const colons = (cleaned.match(/:/g) || []).length;
    const semicolons = (cleaned.match(/;/g) || []).length;
    const ellipsisCount = (cleaned.match(/(\.\.\.|…)/g) || []).length;
    const quoteCount = (cleaned.match(/["'“”‘’]/g) || []).length;
    const parenCount = (cleaned.match(/[()]/g) || []).length;
    const emojiPresent = EMOJI_RE.test(cleaned) ? 1 : 0;

    const per100 = (count) => (count / Math.max(1, wordCount)) * 100;

    const urlCount = (cleaned.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) || []).length;
    const mentionCount = (cleaned.match(/@\w+/g) || []).length;
    const hashtagCount = (cleaned.match(/#\w+/g) || []).length;

    let properNounish = 0;
    const originalWords = (rawText || '').split(/\s+/).filter(Boolean);
    for (let i = 1; i < originalWords.length; i++) {
      const w = originalWords[i].replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
      if (!w) continue;
      if (!/^[A-Z][a-z]+/.test(w)) continue;
      const prev = originalWords[i - 1] || '';
      if (/[.!?]$/.test(prev)) continue;
      properNounish++;
    }
    const properNounishRatio = properNounish / Math.max(1, wordCount);

    const isReply = context && context.kind === 'comment';

    return {
      raw: rawText || '',
      cleaned,
      metrics: {
        wordCount,
        charCount,
        sentenceCount,
        avgSentenceLen,
        sentenceLenCV,
        typeTokenRatio,
        hapaxRatio,
        avgWordLen,
        wordLenCV,
        stopwordRatio,
        bigramRepeatRatio,
        trigramRepeatRatio,
        sentenceStarterRepeatRatio,
        topWordShare,
        newlineRatio,
        listMarkerCount,
        buzzHits,
        hedgeHits,
        transitionHits,
        templateHits,
        exclamations,
        questions,
        commas,
        colons,
        semicolons,
        ellipsisCount,
        quoteRatio: quoteCount / Math.max(1, charCount),
        parenRatio: parenCount / Math.max(1, charCount),
        emojiPresent,
        urlCount,
        mentionCount,
        hashtagCount,
        numberTokenRatio,
        properNounishRatio,
        isReply
      },
      features: {
        typeTokenRatio: clamp(typeTokenRatio, 0, 1),
        sentenceLenCV: clamp(sentenceLenCV / 2, 0, 1),
        avgSentenceLen: clamp(avgSentenceLen / 40, 0, 1),
        bigramRepeatRatio: clamp(bigramRepeatRatio, 0, 1),
        trigramRepeatRatio: clamp(trigramRepeatRatio, 0, 1),
        sentenceStarterRepeatRatio: clamp(sentenceStarterRepeatRatio, 0, 1),
        stopwordRatio: clamp(stopwordRatio, 0, 1),
        hapaxRatio: clamp(hapaxRatio, 0, 1),
        topWordShare: clamp(topWordShare, 0, 1),
        newlineRatio: clamp(newlineRatio / 0.15, 0, 1),
        listMarkerCount: clamp(listMarkerCount / 4, 0, 1),
        discoursePer100w: clamp(per100(transitionHits) / 10, 0, 1),
        templatePer100w: clamp(per100(templateHits) / 6, 0, 1),
        buzzPer100w: clamp(per100(buzzHits) / 6, 0, 1),
        aiHedgePresent: hedgeHits > 0 ? 1 : 0,
        commaPer100w: clamp(per100(commas) / 30, 0, 1),
        colonPer100w: clamp(per100(colons) / 10, 0, 1),
        semicolonPer100w: clamp(per100(semicolons) / 6, 0, 1),
        exclamationsPer100w: clamp(per100(exclamations) / 6, 0, 1),
        questionsPer100w: clamp(per100(questions) / 6, 0, 1),
        ellipsisPer100w: clamp(per100(ellipsisCount) / 4, 0, 1),
        quoteRatio: clamp((quoteCount / Math.max(1, charCount)) / 0.08, 0, 1),
        parenRatio: clamp((parenCount / Math.max(1, charCount)) / 0.08, 0, 1),
        emojiPresent
      }
    };
  }

  const MODEL_POST = {
    intercept: -0.25,
    weights: {
      aiHedgePresent: 2.1,
      templatePer100w: 0.7,
      discoursePer100w: 0.55,
      bigramRepeatRatio: 1.0,
      trigramRepeatRatio: 0.6,
      sentenceStarterRepeatRatio: 0.5,
      buzzPer100w: 0.4,
      typeTokenRatio: -1.0,
      hapaxRatio: -0.45,
      sentenceLenCV: -0.7,
      avgSentenceLen: 0.5,
      colonPer100w: 0.18,
      commaPer100w: 0.15,
      exclamationsPer100w: 0.20,
      questionsPer100w: 0.12,
      emojiPresent: 0.10,
      topWordShare: 0.25
    }
  };

  const MODEL_REPLY = {
    intercept: -0.35,
    weights: {
      aiHedgePresent: 2.0,
      templatePer100w: 0.65,
      discoursePer100w: 0.45,
      bigramRepeatRatio: 0.9,
      trigramRepeatRatio: 0.5,
      sentenceStarterRepeatRatio: 0.45,
      typeTokenRatio: -0.95,
      hapaxRatio: -0.4,
      sentenceLenCV: -0.65,
      avgSentenceLen: 0.45,
      exclamationsPer100w: 0.18,
      emojiPresent: 0.10,
      topWordShare: 0.22
    }
  };

  function scoreWithModel(features, model) {
    let logit = model.intercept || 0;
    const contributions = [];
    const w = model.weights || {};
    for (const k in w) {
      if (!Object.prototype.hasOwnProperty.call(w, k)) continue;
      const coef = w[k];
      const val = (features && typeof features[k] === 'number') ? features[k] : 0;
      const contrib = coef * val;
      logit += contrib;
      contributions.push({ key: k, val, coef, contrib });
    }
    contributions.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
    return { logit, pAI: sigmoid(logit), contributions };
  }

  function adjustForSensitivity(p) {
    const s = (SENSITIVITY || 'balanced').toLowerCase();
    if (s === 'aggressive') return clamp(p + 0.05, 0, 1);
    if (s === 'conservative') return clamp(p - 0.05, 0, 1);
    return clamp(p, 0, 1);
  }

  function computeEvidence(metrics) {
    const wordCount = metrics.wordCount || 0;
    const sentenceCount = metrics.sentenceCount || 0;
    const isReply = !!metrics.isReply;

    let evidence = 'LOW';
    const medMin = isReply ? 12 : 18;
    const highMin = isReply ? 30 : 45;
    if (wordCount >= medMin) evidence = 'MED';
    if (wordCount >= highMin && sentenceCount >= 2) evidence = 'HIGH';

    const downgrade = (metrics.sentenceLenCV >= 1.25) || (metrics.typeTokenRatio >= 0.85);
    let r = evidenceToRank(evidence);
    if (downgrade) r = Math.max(0, r - 1);
    return rankToEvidence(r);
  }

  function computeMixedSignals(pAI, metrics) {
    if (pAI < 0.55) return false;
    const social = (metrics.urlCount || 0) + (metrics.mentionCount || 0) + (metrics.hashtagCount || 0);
    if (social >= 2) return true;
    if ((metrics.numberTokenRatio || 0) >= 0.10) return true;
    if ((metrics.properNounishRatio || 0) >= 0.08) return true;
    return false;
  }

  function labelFrom(pAI, evidence, mixedSignals) {
    const p = clamp(pAI, 0, 1);
    let dataLevel = 'possible';
    let badgeText = 'Possibly AI-assisted';

    if (evidence === 'LOW') {
      if (p < 0.35) { dataLevel = 'unlikely'; badgeText = 'Unlikely AI'; }
      else if (p < 0.65) { dataLevel = 'possible'; badgeText = 'Possibly AI-assisted'; }
      else { dataLevel = 'likely'; badgeText = 'Likely AI-assisted'; }
    } else if (evidence === 'MED') {
      if (p < 0.25) { dataLevel = 'unlikely'; badgeText = 'Unlikely AI'; }
      else if (p < 0.55) { dataLevel = 'possible'; badgeText = 'Possibly AI-assisted'; }
      else if (p < 0.80) { dataLevel = 'likely'; badgeText = 'Likely AI-assisted'; }
      else { dataLevel = 'very'; badgeText = 'Very likely AI'; }
    } else { // HIGH
      if (p < 0.20) { dataLevel = 'unlikely'; badgeText = 'Unlikely AI'; }
      else if (p < 0.50) { dataLevel = 'possible'; badgeText = 'Possibly AI-assisted'; }
      else if (p < 0.75) { dataLevel = 'likely'; badgeText = 'Likely AI-assisted'; }
      else if (p < 0.92) { dataLevel = 'very'; badgeText = 'Very likely AI'; }
      else { dataLevel = 'certain'; badgeText = 'Almost certain AI'; }
    }

    if (mixedSignals) {
      if (dataLevel === 'certain') { dataLevel = 'very'; badgeText = 'Very likely AI'; }
      if (dataLevel === 'very') badgeText = 'Likely AI-assisted';
      badgeText += ' (mixed)';
    }

    return { dataLevel, badgeText };
  }

  function tooltipVerdictFrom(pAI, evidence, mixedSignals, labeled) {
    const p = clamp(pAI, 0, 1);
    if (mixedSignals) return 'Likely AI-assisted (human-edited)';
    if (evidence === 'HIGH' && p >= 0.92) return 'Almost certainly AI-generated';
    if (labeled.dataLevel === 'certain' || labeled.dataLevel === 'very') return 'Very likely AI-generated';
    if (labeled.dataLevel === 'unlikely') return 'Unlikely AI-generated';
    if (labeled.dataLevel === 'possible') return 'Possibly AI-assisted';
    return 'Likely AI-assisted';
  }

  function analyzeText(rawText, context) {
    const extracted = extractFeatures(rawText, context);
    const m = extracted.metrics;

    if (!extracted.cleaned || !m.wordCount) {
      return {
        pAI: 0,
        evidence: 'LOW',
        mixedSignals: false,
        dataLevel: 'na',
        badgeText: 'No text',
        tooltipText: 'No text found.'
      };
    }

    const model = m.isReply ? MODEL_REPLY : MODEL_POST;
    const scored = scoreWithModel(extracted.features, model);
    let pAI = adjustForSensitivity(scored.pAI);

    const lang = isLikelyEnglish(rawText);
    let evidence = computeEvidence(m);
    if (!lang.isEnglishish) {
      evidence = rankToEvidence(Math.max(0, evidenceToRank(evidence) - 1));
      pAI = clamp(pAI - 0.03, 0, 1);
    }

    const mixedSignals = computeMixedSignals(pAI, m);
    const labeled = labelFrom(pAI, evidence, mixedSignals);
    const tooltipVerdict = tooltipVerdictFrom(pAI, evidence, mixedSignals, labeled);

    const counterSignals = [];
    if (m.urlCount) counterSignals.push(`links: ${m.urlCount}`);
    if (m.mentionCount) counterSignals.push(`mentions: ${m.mentionCount}`);
    if (m.hashtagCount) counterSignals.push(`hashtags: ${m.hashtagCount}`);
    if (m.numberTokenRatio >= 0.10) counterSignals.push(`many numbers (${(m.numberTokenRatio * 100).toFixed(0)}% of tokens)`);
    if (m.properNounishRatio >= 0.08) counterSignals.push(`many proper-noun tokens (${(m.properNounishRatio * 100).toFixed(0)}%)`);
    if (!lang.isEnglishish) counterSignals.push('non-English / mixed script');

    const niceName = (k) => {
      const map = {
        aiHedgePresent: 'AI self-disclosure',
        buzzPer100w: 'buzzwords',
        templatePer100w: 'generic templates',
        discoursePer100w: 'discourse markers',
        bigramRepeatRatio: 'bigram repetition',
        trigramRepeatRatio: 'trigram repetition',
        sentenceStarterRepeatRatio: 'sentence-starter repetition',
        typeTokenRatio: 'lexical diversity',
        hapaxRatio: 'hapax ratio',
        sentenceLenCV: 'sentence-length variability',
        avgSentenceLen: 'average sentence length',
        colonPer100w: 'colon density',
        commaPer100w: 'comma density',
        exclamationsPer100w: 'exclamation density',
        questionsPer100w: 'question density',
        emojiPresent: 'emoji present',
        topWordShare: 'top word dominance'
      };
      return map[k] || k;
    };

    const topDrivers = scored.contributions.slice(0, 7).map(d => {
      const sign = d.contrib >= 0 ? '+' : '';
      return `- ${niceName(d.key)}: ${d.val.toFixed(2)} \u2192 ${sign}${d.contrib.toFixed(2)}`;
    }).join('\n');

    const countersLines = counterSignals.length ? counterSignals.map(c => `- ${c}`).join('\n') : '- none';

    const tooltipText = `Verdict: ${tooltipVerdict}
Badge: ${labeled.badgeText}
Evidence: ${evidence}
Estimated AI likelihood: ${formatPercent(pAI)}
Mode: ${(SENSITIVITY || 'balanced').toUpperCase()}

Top drivers (logit contributions):
${topDrivers || '- none'}

Counter-signals:
${countersLines}

Raw metrics:
Words: ${m.wordCount}, Sentences: ${m.sentenceCount}, Avg sent len: ${m.avgSentenceLen.toFixed(1)}, Sent CV: ${m.sentenceLenCV.toFixed(2)}
TTR: ${m.typeTokenRatio.toFixed(2)}, Stopword ratio: ${m.stopwordRatio.toFixed(2)}, Hapax: ${m.hapaxRatio.toFixed(2)}
Bigram rep: ${m.bigramRepeatRatio.toFixed(2)}, Trigram rep: ${m.trigramRepeatRatio.toFixed(2)}, Starter rep: ${m.sentenceStarterRepeatRatio.toFixed(2)}

Disclaimer: Heuristic estimate; not proof.`;

    return {
      pAI,
      evidence,
      mixedSignals,
      dataLevel: labeled.dataLevel,
      badgeText: labeled.badgeText,
      tooltipText,
      metrics: m,
      features: extracted.features
    };
  }

  function createBadge(analysis) {
    const badge = document.createElement('span');
    badge.className = 'ai-heuristic-badge';
    badge.dataset.level = analysis.dataLevel || 'na';
    badge.tabIndex = 0;
    badge.setAttribute('role', 'button');
    badge.setAttribute(
      'aria-label',
      `AI heuristic: ${analysis.badgeText || 'unknown'} (evidence: ${analysis.evidence || 'LOW'}, ${formatPercent(analysis.pAI || 0)})`
    );

    const dot = document.createElement('span');
    dot.className = 'ai-dot';

    const label = document.createElement('span');
    label.className = 'ai-label';
    label.textContent = 'AI';

    const verdict = document.createElement('span');
    verdict.className = 'ai-score';
    verdict.textContent = analysis.badgeText || 'AI';

    function showTooltip() {
      if (badge._aiTooltip) return;
      const tip = document.createElement('div');
      tip.className = 'ai-heuristic-tooltip';
      tip.textContent = analysis.tooltipText || '';
      document.body.appendChild(tip);

      const rect = badge.getBoundingClientRect();
      const pad = 8;
      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + 6;

      const maxLeft = window.scrollX + document.documentElement.clientWidth - tip.offsetWidth - pad;
      if (left > maxLeft) left = Math.max(window.scrollX + pad, maxLeft);

      const viewportBottom = window.scrollY + document.documentElement.clientHeight - pad;
      if (top + tip.offsetHeight > viewportBottom) {
        top = rect.top + window.scrollY - tip.offsetHeight - 6;
      }
      const minTop = window.scrollY + pad;
      if (top < minTop) top = minTop;

      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;

      badge._aiTooltip = tip;
    }

    function hideTooltip() {
      if (!badge._aiTooltip) return;
      badge._aiTooltip.remove();
      badge._aiTooltip = null;
    }

    badge.addEventListener('mouseenter', showTooltip);
    badge.addEventListener('mouseleave', hideTooltip);
    badge.addEventListener('focus', showTooltip);
    badge.addEventListener('blur', hideTooltip);

    if (DEBUG) {
      badge.addEventListener('click', (ev) => {
        ev.preventDefault();
        console.log('[AI-heuristic][debug]', analysis);
      });
    }

    badge.appendChild(dot);
    badge.appendChild(label);
    badge.appendChild(verdict);
    return badge;
  }

  function findPostText(postEl) {
    // X (Twitter) post/reply text containers
    const candidates = postEl.querySelectorAll(
      'div[data-testid="tweetText"], div[lang], span[lang]'
    );
    let best = '';
    for (let i = 0; i < candidates.length; i++) {
      const txt = candidates[i].textContent || '';
      if (txt.length > best.length) best = txt;
    }
    return normalizeText(best);
  }

  function placeBadge(postEl, badge) {
    // X header area (name/handle row)
    const header = postEl.querySelector('div[data-testid="User-Name"]');
    if (header) {
      header.appendChild(badge);
      return true;
    }
    // Fallback: top of post
    postEl.insertBefore(badge, postEl.firstChild);
    return true;
  }

  function processPost(postEl) {
    if (postEl.dataset.aiHeuristicProcessed === '1') return;
    if (postEl.querySelector('.ai-heuristic-badge')) return;
    const text = findPostText(postEl);
    if (!text) return;

    const analysis = analyzeText(text, { kind: 'post' });
    const badge = createBadge(analysis);
    placeBadge(postEl, badge);

    postEl.dataset.aiHeuristicProcessed = '1';
  }

  const POST_SELECTORS = [
    'article[role="article"]'
  ];

  function scan() {
    const posts = document.querySelectorAll(POST_SELECTORS.join(', '));
    if (posts.length) {
      for (let i = 0; i < posts.length; i++) {
        // Skip replies; they are handled in scanComments() so reply thresholds apply.
        if (posts[i].querySelector('div[data-testid="socialContext"]')) continue;
        processPost(posts[i]);
      }
      return;
    }
    // Mobile fallback: try articles inside main
    const fallback = document.querySelectorAll('main article');
    for (let i = 0; i < fallback.length; i++) {
      const el = fallback[i];
      if (el.querySelector && el.querySelector('div[data-testid="socialContext"]')) continue;
      const text = findPostText(el);
      if (text && text.length >= 80) {
        processPost(el);
      }
    }
  }

  function scanComments() {
    // Try to target replies specifically to avoid re-processing every tweet as a "comment".
    // `socialContext` is commonly used for the "Replying to" row.
    const contexts = document.querySelectorAll('article[role="article"] div[data-testid="socialContext"]');
    for (let i = 0; i < contexts.length; i++) {
      const article = contexts[i].closest('article[role="article"]');
      if (article) processComment(article);
    }
  }

  function processComment(commentEl) {
    if (commentEl.dataset.aiHeuristicProcessed === '1') return;
    const text = findPostText(commentEl);
    if (!text) return;

    const analysis = analyzeText(text, { kind: 'comment' });
    const badge = createBadge(analysis);

    // Prefer placing at the top of the comment block
    const textHost = commentEl.querySelector('div[data-testid="tweetText"], div[lang], span[lang]');
    if (textHost && textHost.parentElement) {
      textHost.parentElement.insertBefore(badge, textHost);
    } else {
      commentEl.insertBefore(badge, commentEl.firstChild);
    }

    commentEl.dataset.aiHeuristicProcessed = '1';
  }

  let scanQueued = false;
  const observer = new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => {
      scanQueued = false;
      scan();
      scanComments();
    }, 200);
  });

  function init() {
    scan();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
