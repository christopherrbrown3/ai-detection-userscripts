// Safari Userscripts install:
// 1) Install the Userscripts extension for Safari.
// 2) Open Userscripts -> Manage -> Open Scripts Folder.
// 3) Copy this file into that folder and enable it.
// 4) Visit https://www.reddit.com/ (or https://old.reddit.com/) and refresh.
//
// ==UserScript==
// @name         Reddit AI Content Heuristic (Safari Userscripts)
// @version      0.1.0
// @description  Adds a small AI-likelihood label next to Reddit posts/comments (local heuristic only). Safari-optimized for the Userscripts extension.
// @author       christopherrbrown3
// @match        https://www.reddit.com/*
// @match        https://reddit.com/*
// @match        https://old.reddit.com/*
// @match        https://www.old.reddit.com/*
// @run-at       document-idle
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

  // Safari may not support Unicode property escapes.
  let EMOJI_RE;
  try {
    EMOJI_RE = new RegExp('[\\p{Extended_Pictographic}]', 'u');
  } catch (err) {
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

  function countPhraseHits(lower, phrases) {
    let hits = 0;
    for (let i = 0; i < phrases.length; i++) if (lower.indexOf(phrases[i]) !== -1) hits++;
    return hits;
  }

  function extractFeatures(rawText, context) {
    const raw = normalizeText(rawText);
    const cleaned = cleanForTokens(raw);
    const lower = cleaned.toLowerCase();

    const rawWords = cleaned ? cleaned.split(' ') : [];
    const tokens = [];
    for (let i = 0; i < rawWords.length; i++) {
      const t = stripToken(rawWords[i]);
      if (t) tokens.push(t);
    }

    const normTokens = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].toLowerCase();
      if (/[a-z0-9]/.test(t)) normTokens.push(t);
    }

    const wordCount = normTokens.length;
    const charCount = cleaned.length;

    const lines = (rawText || '').replace(/\r/g, '').split('\n');
    let listMarkerCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const ln = (lines[i] || '').trimStart();
      if (!ln) continue;
      if (/^(\u2022|-|\*|\d+[\.\)])\s+/.test(ln)) listMarkerCount++;
    }

    const newlineCount = (rawText || '').split('\n').length - 1;
    const newlineRatio = newlineCount / Math.max(1, (rawText || '').length);

    const sentences = cleaned ? cleaned.split(/[.!?]+/) : [];
    const sentenceLens = [];
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i].trim();
      if (!s) continue;
      const ws = s.split(' ');
      let c = 0;
      for (let j = 0; j < ws.length; j++) if (stripToken(ws[j])) c++;
      if (c) sentenceLens.push(c);
    }
    const sentenceCount = Math.max(1, sentenceLens.length || (sentences.filter(Boolean).length || 1));
    let sentMean = 0;
    for (let i = 0; i < sentenceLens.length; i++) sentMean += sentenceLens[i];
    sentMean = sentenceLens.length ? sentMean / sentenceLens.length : 0;
    let sentVar = 0;
    for (let i = 0; i < sentenceLens.length; i++) sentVar += Math.pow(sentenceLens[i] - sentMean, 2);
    sentVar = sentenceLens.length ? sentVar / sentenceLens.length : 0;
    const sentStd = Math.sqrt(sentVar);
    const sentenceLenCV = sentMean ? (sentStd / sentMean) : 0;
    const avgSentenceLen = sentMean || (wordCount ? (wordCount / sentenceCount) : 0);

    const uniq = new Set(normTokens);
    const typeTokenRatio = wordCount ? (uniq.size / wordCount) : 0;

    const freq = {};
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
    const hapaxRatio = wordCount ? (hapaxCount / wordCount) : 0;
    const topWordShare = wordCount ? (top1 / wordCount) : 0;

    const bigrams = [];
    for (let i = 0; i < wordCount - 1; i++) bigrams.push(`${normTokens[i]} ${normTokens[i + 1]}`);
    let bigramRepeatRatio = 0;
    if (bigrams.length) {
      const set = new Set(bigrams);
      bigramRepeatRatio = 1 - (set.size / bigrams.length);
    }

    const trigrams = [];
    for (let i = 0; i < wordCount - 2; i++) trigrams.push(`${normTokens[i]} ${normTokens[i + 1]} ${normTokens[i + 2]}`);
    let trigramRepeatRatio = 0;
    if (trigrams.length) {
      const set = new Set(trigrams);
      trigramRepeatRatio = 1 - (set.size / trigrams.length);
    }

    const starters = [];
    for (let i = 0; i < sentences.length; i++) {
      const s = (sentences[i] || '').trim();
      if (!s) continue;
      const ws = s.split(' ');
      const w0 = stripToken(ws[0] || '');
      const w1 = stripToken(ws[1] || '');
      if (w0 && w1) starters.push(`${w0.toLowerCase()} ${w1.toLowerCase()}`);
    }
    let sentenceStarterRepeatRatio = 0;
    if (starters.length) {
      const set = new Set(starters);
      sentenceStarterRepeatRatio = 1 - (set.size / starters.length);
    }

    let stopHits = 0;
    let numberHits = 0;
    for (let i = 0; i < normTokens.length; i++) {
      const w = normTokens[i];
      if (STOP_SET.has(w)) stopHits++;
      if (/\d/.test(w)) numberHits++;
    }
    const stopwordRatio = wordCount ? (stopHits / wordCount) : 0;
    const numberTokenRatio = wordCount ? (numberHits / wordCount) : 0;

    const buzzHits = countPhraseHits(lower, AI_BUZZ);
    const hedgeHits = countPhraseHits(lower, HEDGE);
    const transitionHits = countPhraseHits(lower, TRANSITIONS);
    const templateHits = countPhraseHits(lower, GENERIC_TEMPLATES);

    const exclamations = (cleaned.match(/!/g) || []).length;
    const questions = (cleaned.match(/\?/g) || []).length;
    const commas = (cleaned.match(/,/g) || []).length;
    const colons = (cleaned.match(/:/g) || []).length;
    const semicolons = (cleaned.match(/;/g) || []).length;
    const ellipsisCount = (cleaned.match(/(\.\.\.|…)/g) || []).length;
    const quoteCount = (cleaned.match(/[\"'“”‘’]/g) || []).length;
    const parenCount = (cleaned.match(/[()]/g) || []).length;

    const emojiPresent = EMOJI_RE.test(cleaned) ? 1 : 0;

    const urlCount = (cleaned.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) || []).length;
    const atMentions = (cleaned.match(/@\w+/g) || []).length;
    const redditMentions = (cleaned.match(/(?:^|[^A-Za-z0-9_])\/?u\/[A-Za-z0-9_-]+/g) || []).length;
    const subredditMentions = (cleaned.match(/(?:^|[^A-Za-z0-9_])\/?r\/[A-Za-z0-9_]+/g) || []).length;
    const mentionCount = atMentions + redditMentions + subredditMentions;
    const hashtagCount = (cleaned.match(/#\w+/g) || []).length;

    let properNounish = 0;
    const originalWords = (rawText || '').split(/\s+/).filter(Boolean);
    for (let i = 1; i < originalWords.length; i++) {
      const w = (originalWords[i] || '').replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
      if (!w) continue;
      if (!/^[A-Z][a-z]+/.test(w)) continue;
      const prev = originalWords[i - 1] || '';
      if (/[.!?]$/.test(prev)) continue;
      properNounish++;
    }
    const properNounishRatio = wordCount ? (properNounish / wordCount) : 0;

    const isComment = (context && context.kind === 'comment') ? 1 : 0;

    function per100(count) {
      return wordCount ? ((count / wordCount) * 100) : 0;
    }

    return {
      cleaned,
      metrics: {
        wordCount,
        charCount,
        sentenceCount,
        avgSentenceLen,
        sentenceLenCV,
        typeTokenRatio,
        hapaxRatio,
        stopwordRatio,
        bigramRepeatRatio,
        trigramRepeatRatio,
        sentenceStarterRepeatRatio,
        topWordShare,
        newlineRatio,
        listMarkerCount,
        emojiPresent,
        urlCount,
        mentionCount,
        hashtagCount,
        numberTokenRatio,
        properNounishRatio,
        isComment
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
        quoteRatio: clamp(((quoteCount / Math.max(1, charCount)) / 0.08), 0, 1),
        parenRatio: clamp(((parenCount / Math.max(1, charCount)) / 0.08), 0, 1),
        emojiPresent
      }
    };
  }

  const MODEL_POST = {
    intercept: -0.30,
    weights: {
      aiHedgePresent: 2.1,
      templatePer100w: 0.7,
      discoursePer100w: 0.55,
      bigramRepeatRatio: 1.0,
      trigramRepeatRatio: 0.6,
      sentenceStarterRepeatRatio: 0.5,
      buzzPer100w: 0.35,
      typeTokenRatio: -1.0,
      hapaxRatio: -0.45,
      sentenceLenCV: -0.7,
      avgSentenceLen: 0.55,
      listMarkerCount: 0.30,
      colonPer100w: 0.18,
      commaPer100w: 0.14,
      exclamationsPer100w: 0.10,
      questionsPer100w: 0.10,
      emojiPresent: 0.05,
      topWordShare: 0.22
    }
  };

  const MODEL_COMMENT = {
    intercept: -0.45,
    weights: {
      aiHedgePresent: 2.0,
      templatePer100w: 0.65,
      discoursePer100w: 0.45,
      bigramRepeatRatio: 0.9,
      trigramRepeatRatio: 0.5,
      sentenceStarterRepeatRatio: 0.45,
      typeTokenRatio: -0.95,
      hapaxRatio: -0.40,
      sentenceLenCV: -0.65,
      avgSentenceLen: 0.45,
      exclamationsPer100w: 0.10,
      questionsPer100w: 0.10,
      emojiPresent: 0.05,
      topWordShare: 0.20
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
    const isComment = !!metrics.isComment;

    let evidence = 'LOW';
    const medMin = isComment ? 15 : 25;
    const highMin = isComment ? 35 : 60;
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

    const model = m.isComment ? MODEL_COMMENT : MODEL_POST;
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
        listMarkerCount: 'list structure',
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
      return `- ${niceName(d.key)}: ${d.val.toFixed(2)} -> ${sign}${d.contrib.toFixed(2)}`;
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

  function collectBestText(el, selectors) {
    if (!el) return '';
    const candidates = el.querySelectorAll(selectors);
    let best = '';
    for (let i = 0; i < candidates.length; i++) {
      const t = (candidates[i].textContent || '').trim();
      if (t.length > best.length) best = t;
    }
    return normalizeText(best);
  }

  function findPostText(postEl) {
    // Prefer title + body when available, to reduce false negatives on short titles.
    const title = collectBestText(postEl, 'h1, h3, a.title, a[data-testid="post-title"], [slot="title"]');
    const body = collectBestText(
      postEl,
      'div[data-click-id="text"], div[data-testid="post-content"], div[data-testid="post-container"] div[lang], ' +
      'div.usertext-body, div.md, [slot="text"], [data-testid="post-body"]'
    );

    if (title && body) {
      // Avoid obvious duplication: sometimes the body container includes the title.
      const lowerTitle = title.toLowerCase();
      const lowerBody = body.toLowerCase();
      if (lowerBody.indexOf(lowerTitle) !== -1 && lowerTitle.length >= 20) return normalizeText(body);
      return normalizeText(`${title}\n${body}`);
    }
    return normalizeText(title || body);
  }

  function findCommentText(commentEl) {
    return collectBestText(
      commentEl,
      'div[data-testid="comment"] div[lang], div[data-testid="comment"] p, div[data-testid="comment"] span, ' +
      'div.commentarea div.md, div.md, [slot="comment"], [data-testid="comment-content"], p'
    );
  }

  function placePostBadge(postEl, badge) {
    // Old Reddit: title row.
    const oldTitle = postEl.querySelector('p.title, a.title');
    if (oldTitle && oldTitle.parentElement) {
      oldTitle.appendChild(badge);
      return true;
    }

    // New Reddit: near title or author header.
    const header = postEl.querySelector('a[data-testid="post_author_link"], [data-testid="post-author-link"], header') ||
      postEl.querySelector('h1, h3');
    if (header && header.parentElement) {
      header.parentElement.appendChild(badge);
      return true;
    }

    postEl.insertBefore(badge, postEl.firstChild);
    return true;
  }

  function placeCommentBadge(commentEl, badge) {
    // Old Reddit: tagline row.
    const tagline = commentEl.querySelector('p.tagline');
    if (tagline) {
      tagline.appendChild(badge);
      return true;
    }

    // New Reddit: look for a header row near author.
    const header = commentEl.querySelector('a[data-testid="comment_author_link"], [data-testid="comment-author-link"], header');
    if (header && header.parentElement) {
      header.parentElement.appendChild(badge);
      return true;
    }

    commentEl.insertBefore(badge, commentEl.firstChild);
    return true;
  }

  function processPost(postEl) {
    if (!postEl || postEl.nodeType !== 1) return;
    if (postEl.dataset.aiHeuristicProcessed === '1') return;
    if (postEl.querySelector && postEl.querySelector('.ai-heuristic-badge')) return;

    const text = findPostText(postEl);
    if (!text) return;

    const analysis = analyzeText(text, { kind: 'post' });
    const badge = createBadge(analysis);
    placePostBadge(postEl, badge);

    postEl.dataset.aiHeuristicProcessed = '1';
  }

  function processComment(commentEl) {
    if (!commentEl || commentEl.nodeType !== 1) return;
    if (commentEl.dataset.aiHeuristicProcessed === '1') return;
    if (commentEl.querySelector && commentEl.querySelector('.ai-heuristic-badge')) return;

    const text = findCommentText(commentEl);
    if (!text) return;

    const analysis = analyzeText(text, { kind: 'comment' });
    const badge = createBadge(analysis);
    placeCommentBadge(commentEl, badge);

    commentEl.dataset.aiHeuristicProcessed = '1';
  }

  const POST_SELECTORS = [
    // New reddit
    'div[data-testid="post-container"]',
    'shreddit-post',
    // Old reddit
    'div.thing.link',
    'div.thing.self'
  ];

  const COMMENT_SELECTORS = [
    // New reddit
    'div[data-testid="comment"]',
    'shreddit-comment',
    // Old reddit
    'div.comment'
  ];

  function scan() {
    const posts = document.querySelectorAll(POST_SELECTORS.join(', '));
    for (let i = 0; i < posts.length; i++) processPost(posts[i]);
  }

  function scanComments() {
    const comments = document.querySelectorAll(COMMENT_SELECTORS.join(', '));
    for (let i = 0; i < comments.length; i++) processComment(comments[i]);
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
    scanComments();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
