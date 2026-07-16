// Generated file. Edit src/, models/default-models.json, or scripts/build_userscripts.py instead.
// Installation and documentation: https://github.com/christopherrbrown3/ai-detection-userscripts

// ==UserScript==
// @name         Reddit AI-Style Signal (Local)
// @namespace    https://github.com/christopherrbrown3/ai-detection-userscripts
// @version      0.3.0
// @description  Adds an experimental, privacy-preserving AI-style signal to Reddit posts and comments.
// @author       christopherrbrown3
// @license      MIT
// @homepageURL  https://github.com/christopherrbrown3/ai-detection-userscripts
// @supportURL   https://github.com/christopherrbrown3/ai-detection-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/reddit-ai-heuristic.userscripts.user.js
// @updateURL    https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/reddit-ai-heuristic.userscripts.user.js
// @match        https://www.reddit.com/*
// @match        https://reddit.com/*
// @match        https://old.reddit.com/*
// @match        https://www.old.reddit.com/*
// @run-at       document-idle
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const AI_HEURISTIC_MODELS = {"schema_version":2,"metadata":{"version":"0.2.0","calibrated":false,"provenance":"Hand-tuned experimental baseline retained for continuity. Replace with offline-trained and held-out calibrated models before treating scores as probabilities.","feature_set":"stylometry-v2-charhash128"},"models":{"reddit:post":{"intercept":-0.3,"weights":{"aiHedgePresent":2.1,"templatePer100w":0.7,"discoursePer100w":0.55,"bigramRepeatRatio":1.0,"trigramRepeatRatio":0.6,"sentenceStarterRepeatRatio":0.5,"buzzPer100w":0.35,"mattr25":-0.75,"sentenceLenCV":-0.7,"avgSentenceLen":0.55,"wordLenCV":-0.18,"paragraphLenCV":-0.18,"contractionRatio":-0.16,"listMarkerCount":0.3,"colonPer100w":0.18,"commaPer100w":0.14,"exclamationsPer100w":0.1,"questionsPer100w":0.1,"topWordShare":0.22},"calibration":null,"thresholds":{"moderate":0.56,"strong":0.74,"target_fpr":null,"method":"experimental-default"}},"reddit:comment":{"intercept":-0.45,"weights":{"aiHedgePresent":2.0,"templatePer100w":0.65,"discoursePer100w":0.45,"bigramRepeatRatio":0.9,"trigramRepeatRatio":0.5,"sentenceStarterRepeatRatio":0.45,"mattr25":-0.65,"sentenceLenCV":-0.65,"avgSentenceLen":0.45,"wordLenCV":-0.15,"contractionRatio":-0.16,"exclamationsPer100w":0.1,"questionsPer100w":0.1,"topWordShare":0.2},"calibration":null,"thresholds":{"moderate":0.59,"strong":0.77,"target_fpr":null,"method":"experimental-default"}}}};

function createDetectorEngine(options) {
  'use strict';

  const config = options || {};
  const platform = config.platform || 'unknown';
  const modelBundle = config.modelBundle || { metadata: {}, models: {} };
  const CHAR_HASH_DIM = 128;
  const ANALYSIS_VERSION = 'stylometry-v2';

  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'because', 'so', 'of', 'to', 'in', 'on',
    'for', 'with', 'by', 'as', 'at', 'from', 'that', 'this', 'these', 'those', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
    'i', 'me', 'my', 'he', 'his', 'she', 'her', 'not', 'no', 'yes', 'do', 'does', 'did', 'can',
    'could', 'would', 'should', 'may', 'might', 'must', 'will', 'just', 'have', 'has', 'had'
  ]);

  const FIRST_PERSON = new Set(['i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours']);
  const SECOND_PERSON = new Set(['you', 'your', 'yours', 'yourself', 'yourselves']);

  const PHRASES = {
    buzz: [
      'synergy', 'leverage', 'unlock', 'paradigm', 'disrupt', 'innovative', 'thought leadership',
      'game-changer', 'empower', 'elevate', 'journey', 'mission', 'vision', 'stakeholders',
      'scalable', 'robust', 'strategic', 'amazing', 'incredible', 'excited to announce',
      'thrilled to', 'grateful for', 'honored to', 'humble', 'delighted to share', 'proud to'
    ],
    hedge: [
      'as an ai', 'as a language model', 'i cannot', "i'm unable", 'i am unable',
      "i don't have access", 'cannot provide', 'i cannot provide'
    ],
    transition: [
      'in conclusion', 'overall', 'to sum up', 'moreover', 'furthermore', 'additionally',
      'in addition', 'on the other hand', 'as a result', 'in summary', 'it is important to',
      'it is worth noting', 'at the end of the day', 'in the meantime', 'that said',
      'in other words', 'to be clear', 'to put it simply', 'as such', 'with that in mind'
    ],
    template: [
      "here's the thing", "let's dive in", 'key takeaways', 'tldr', 'tl;dr', "in today's world",
      'i want to share', "i'm excited to share", "if you're", 'what i learned', 'lessons learned',
      'actionable steps', 'in this post', 'in this thread', 'here are', "here's how", 'here is how',
      'step by step'
    ],
    rhetorical: [
      "here's what", 'here is what', 'what this means', 'why it matters', 'the takeaway',
      'the bottom line', 'let that sink in', 'read that again', 'the lesson', 'the reality is',
      'make no mistake', "it's not about", "this isn't about", 'the question is'
    ]
  };

  const FEATURE_NAMES = {
    aiHedgePresent: 'AI self-disclosure',
    buzzPer100w: 'stock promotional wording',
    templatePer100w: 'generic template phrases',
    discoursePer100w: 'formal transition phrases',
    bigramRepeatRatio: 'word-pair repetition',
    trigramRepeatRatio: 'three-word repetition',
    sentenceStarterRepeatRatio: 'reused sentence openings',
    typeTokenRatio: 'raw lexical diversity',
    mattr25: 'length-adjusted lexical diversity',
    sentenceLenCV: 'sentence-length variation',
    avgSentenceLen: 'average sentence length',
    wordLenCV: 'word-length variation',
    paragraphLenCV: 'paragraph-length variation',
    contractionRatio: 'contractions',
    firstPersonRatio: 'first-person language',
    secondPersonRatio: 'second-person language',
    shortSentenceRatio: 'short-sentence share',
    charTrigramRepeatRatio: 'character-pattern repetition',
    punctuationVariety: 'punctuation variety',
    listMarkerCount: 'list structure',
    colonPer100w: 'colon density',
    commaPer100w: 'comma density',
    exclamationsPer100w: 'exclamation density',
    questionsPer100w: 'question density',
    topWordShare: 'most-common-word share'
  };

  const EVIDENCE_LIMITS = {
    linkedin: { post: [20, 35, 90], comment: [15, 30, 65] },
    reddit: { post: [20, 35, 75], comment: [15, 30, 60] },
    x: { post: [18, 30, 55], comment: [15, 25, 45] },
    unknown: { post: [20, 35, 75], comment: [15, 30, 60] }
  };

  let unicodeWordRe;
  let unicodeLetterRe;
  try {
    unicodeWordRe = new RegExp("[\\p{L}\\p{N}]+(?:['’][\\p{L}]+)?", 'gu');
    unicodeLetterRe = new RegExp('\\p{L}', 'gu');
  } catch (error) {
    unicodeWordRe = /[A-Za-z0-9]+(?:['’][A-Za-z]+)?/g;
    unicodeLetterRe = /[A-Za-z]/g;
  }

  let emojiRe;
  try {
    emojiRe = new RegExp('\\p{Extended_Pictographic}', 'u');
  } catch (error) {
    emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function sigmoid(value) {
    if (value >= 20) return 1;
    if (value <= -20) return 0;
    return 1 / (1 + Math.exp(-value));
  }

  function normalizeText(text) {
    return String(text || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .trim();
  }

  function normalizeApostrophes(text) {
    return String(text || '').replace(/[‘’]/g, "'");
  }

  function tokenize(text) {
    const matches = normalizeApostrophes(text).match(unicodeWordRe) || [];
    return matches.map((token) => token.toLowerCase());
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function coefficientOfVariation(values) {
    if (!values.length) return 0;
    const average = mean(values);
    if (!average) return 0;
    const variance = mean(values.map((value) => Math.pow(value - average, 2)));
    return Math.sqrt(variance) / average;
  }

  function movingAverageTypeTokenRatio(tokens, windowSize) {
    if (!tokens.length) return 0;
    const size = Math.min(windowSize, tokens.length);
    if (tokens.length <= size) return new Set(tokens).size / tokens.length;
    let total = 0;
    let windows = 0;
    for (let index = 0; index <= tokens.length - size; index += 1) {
      total += new Set(tokens.slice(index, index + size)).size / size;
      windows += 1;
    }
    return windows ? total / windows : 0;
  }

  function repeatedNgramRatio(tokens, size) {
    if (tokens.length < size) return 0;
    const ngrams = [];
    for (let index = 0; index <= tokens.length - size; index += 1) {
      ngrams.push(tokens.slice(index, index + size).join(' '));
    }
    return 1 - (new Set(ngrams).size / ngrams.length);
  }

  function characterTrigramRepeatRatio(text) {
    const normalized = normalizeText(text).toLowerCase().replace(/\s+/g, ' ');
    if (normalized.length < 3) return 0;
    const grams = [];
    for (let index = 0; index <= normalized.length - 3; index += 1) {
      grams.push(normalized.slice(index, index + 3));
    }
    return 1 - (new Set(grams).size / grams.length);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function countPhraseHits(text, phrases) {
    const normalized = normalizeApostrophes(text).toLowerCase();
    let total = 0;
    for (const phrase of phrases) {
      const source = `(^|[^a-z0-9])${escapeRegExp(phrase)}(?=$|[^a-z0-9])`;
      const matches = normalized.match(new RegExp(source, 'g'));
      total += matches ? matches.length : 0;
    }
    return total;
  }

  function matchedPhrases(text, phrases) {
    const normalized = normalizeApostrophes(text).toLowerCase();
    return phrases.filter((phrase) => {
      const source = `(^|[^a-z0-9])${escapeRegExp(phrase)}(?=$|[^a-z0-9])`;
      return new RegExp(source).test(normalized);
    });
  }

  function repeatedContentBigramRatio(tokens) {
    const content = tokens.filter((token) => token.length > 2 && !STOPWORDS.has(token));
    if (content.length < 12) return 0;
    const counts = new Map();
    for (let index = 0; index < content.length - 1; index += 1) {
      const key = `${content[index]} ${content[index + 1]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const repeated = Array.from(counts.values()).filter((count) => count > 1)
      .reduce((sum, count) => sum + count - 1, 0);
    return repeated / Math.max(1, content.length - 1);
  }

  function heuristicCoverage(metrics) {
    if (metrics.language.state === 'unsupported') {
      return { level: 'unsupported', text: 'Unsupported-language sample', reason: metrics.language.reason };
    }
    if (metrics.wordCount < 20 || metrics.sentenceCount < 2) {
      return {
        level: 'short',
        text: 'Short sample',
        reason: 'fewer than 20 words or 2 sentences'
      };
    }
    if (metrics.wordCount >= 80 && metrics.sentenceCount >= 4 && metrics.language.state === 'supported') {
      return {
        level: 'long',
        text: 'Long sample',
        reason: 'at least 80 words and 4 sentences'
      };
    }
    return {
      level: 'standard',
      text: 'Standard sample',
      reason: 'at least 20 words and 2 sentences, below the long-sample cutoff'
    };
  }

  function analyzeStyleCues(rawText, extracted) {
    const raw = normalizeText(rawText);
    const sentences = raw.split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const sentenceLengths = sentences.map((sentence) => tokenize(sentence).length).filter(Boolean);
    const families = [];

    const hedgeMatches = matchedPhrases(raw, PHRASES.hedge);
    if (hedgeMatches.length) {
      families.push({
        id: 'self-disclosure',
        name: 'AI self-reference',
        points: 3,
        detail: `Explicit wording: ${hedgeMatches.slice(0, 2).join(', ')}`
      });
    }

    const framingMatches = [
      ...matchedPhrases(raw, PHRASES.template),
      ...matchedPhrases(raw, PHRASES.transition),
      ...matchedPhrases(raw, PHRASES.rhetorical)
    ];
    const buzzMatches = matchedPhrases(raw, PHRASES.buzz);
    const formulaicStrength = framingMatches.length + (buzzMatches.length >= 2 ? 1 : 0);
    if (formulaicStrength) {
      const examples = Array.from(new Set([...framingMatches, ...buzzMatches])).slice(0, 4);
      families.push({
        id: 'formulaic-framing',
        name: 'Formulaic framing',
        points: formulaicStrength >= 3 ? 2 : 1,
        detail: `Stock framing or promotional phrases: ${examples.join(', ')}`
      });
    }

    const ignoredStarters = new Set(['i', 'we', 'you', 'the', 'a', 'an', 'this', 'that', 'it']);
    const starterCounts = new Map();
    for (const sentence of sentences) {
      const starter = tokenize(sentence)[0];
      if (!starter || ignoredStarters.has(starter)) continue;
      starterCounts.set(starter, (starterCounts.get(starter) || 0) + 1);
    }
    const repeatedStarters = Array.from(starterCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((left, right) => right[1] - left[1]);
    let maxShortRun = 0;
    let shortRun = 0;
    for (const length of sentenceLengths) {
      if (length <= 12) {
        shortRun += 1;
        maxShortRun = Math.max(maxShortRun, shortRun);
      } else shortRun = 0;
    }
    if (repeatedStarters.length || maxShortRun >= 3) {
      const details = [];
      if (repeatedStarters.length) {
        details.push(`repeated openings (${repeatedStarters.slice(0, 3).map(([word, count]) => `${word} x${count}`).join(', ')})`);
      }
      if (maxShortRun >= 3) details.push(`${maxShortRun} consecutive short rhetorical sentences`);
      families.push({
        id: 'parallel-rhythm',
        name: 'Parallel rhetorical rhythm',
        points: repeatedStarters.length && maxShortRun >= 3 ? 2 : 1,
        detail: details.join('; ')
      });
    }

    const listMarkers = raw.split('\n').filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line)).length;
    const colonCount = (raw.match(/:/g) || []).length;
    const emDashCount = (raw.match(/[—–]/g) || []).length;
    if (listMarkers >= 3 || (colonCount >= 2 && emDashCount >= 1) || (emDashCount >= 3 && sentences.length >= 4)) {
      const parts = [];
      if (listMarkers) parts.push(`${listMarkers} list markers`);
      if (colonCount) parts.push(`${colonCount} colons`);
      if (emDashCount) parts.push(`${emDashCount} dash asides`);
      families.push({
        id: 'structured-presentation',
        name: 'Highly structured presentation',
        points: 1,
        detail: parts.join(', ')
      });
    }

    if (sentences.length >= 5 && extracted.metrics.sentenceLenCV <= 0.28) {
      families.push({
        id: 'sentence-uniformity',
        name: 'Uniform sentence cadence',
        points: 1,
        detail: `Sentence-length variation is low across ${sentences.length} sentences`
      });
    }

    const contentRepeat = repeatedContentBigramRatio(extracted.tokens);
    if (extracted.metrics.wordCount >= 60 && contentRepeat >= 0.08) {
      families.push({
        id: 'content-repetition',
        name: 'Repeated content phrasing',
        points: 1,
        detail: `${Math.round(contentRepeat * 100)}% repeated content-word pairs after stopword removal`
      });
    }

    const coverage = heuristicCoverage(extracted.metrics);
    const points = families.reduce((sum, family) => sum + family.points, 0);
    const totalFamilies = 6;
    const level = families.length === 0 ? 'cue-none' : families.length === 1 ? 'cue-one' : 'cue-multiple';
    const text = `${families.length}/${totalFamilies} cue families`;
    return { level, text, points, families, totalFamilies, coverage, contentRepeat };
  }

  function fnv1a(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hashedCharacterNgrams(text, dimension) {
    const dim = dimension || CHAR_HASH_DIM;
    const vector = new Array(dim).fill(0);
    const normalized = normalizeApostrophes(text)
      .toLowerCase()
      .replace(/\d/g, '0')
      .replace(/\s+/g, ' ')
      .trim();
    for (let size = 3; size <= 5; size += 1) {
      for (let index = 0; index <= normalized.length - size; index += 1) {
        const hash = fnv1a(normalized.slice(index, index + size));
        const bucket = hash % dim;
        const sign = (hash & 0x40000000) === 0 ? 1 : -1;
        vector[bucket] += sign;
      }
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return norm ? vector.map((value) => value / norm) : vector;
  }

  function languageSupport(rawText, tokens, stopwordRatio) {
    const letters = rawText.match(unicodeLetterRe) || [];
    if (!letters.length) return { state: 'unsupported', latinRatio: 0, reason: 'no letter evidence' };
    const latinLetters = (rawText.match(/[A-Za-z]/g) || []).length;
    const latinRatio = latinLetters / letters.length;
    if (latinRatio < 0.72) {
      return { state: 'unsupported', latinRatio, reason: 'non-Latin or mixed-script text' };
    }
    if (tokens.length >= 20 && stopwordRatio < 0.055) {
      return { state: 'uncertain', latinRatio, reason: 'English language could not be established' };
    }
    return { state: 'supported', latinRatio, reason: '' };
  }

  function extractFeatures(rawText, context) {
    const raw = normalizeText(rawText);
    const cleaned = raw.replace(/\s+/g, ' ');
    const tokens = tokenize(cleaned);
    const wordCount = tokens.length;
    const charCount = cleaned.length;

    const sentenceTexts = cleaned.split(/[.!?]+|\n+/).map((value) => value.trim()).filter(Boolean);
    const sentenceLengths = sentenceTexts.map((sentence) => tokenize(sentence).length).filter(Boolean);
    const sentenceCount = Math.max(1, sentenceLengths.length);
    const avgSentenceLen = mean(sentenceLengths) || wordCount;
    const sentenceLenCV = coefficientOfVariation(sentenceLengths);
    const shortSentenceRatio = sentenceLengths.length
      ? sentenceLengths.filter((length) => length <= 8).length / sentenceLengths.length
      : 0;

    const paragraphLengths = raw.split(/\n+/).map((paragraph) => tokenize(paragraph).length).filter(Boolean);
    const paragraphLenCV = coefficientOfVariation(paragraphLengths);
    const wordLengths = tokens.map((token) => token.replace(/['’]/g, '').length).filter(Boolean);
    const wordLenCV = coefficientOfVariation(wordLengths);

    const frequencies = new Map();
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
    const uniqueCount = frequencies.size;
    const hapaxCount = Array.from(frequencies.values()).filter((count) => count === 1).length;
    const topCount = frequencies.size ? Math.max(...frequencies.values()) : 0;
    const typeTokenRatio = wordCount ? uniqueCount / wordCount : 0;
    const hapaxRatio = wordCount ? hapaxCount / wordCount : 0;
    const topWordShare = wordCount ? topCount / wordCount : 0;
    const mattr25 = movingAverageTypeTokenRatio(tokens, 25);

    const sentenceStarters = sentenceTexts.map((sentence) => tokenize(sentence).slice(0, 2).join(' ')).filter(Boolean);
    const sentenceStarterRepeatRatio = sentenceStarters.length
      ? 1 - (new Set(sentenceStarters).size / sentenceStarters.length)
      : 0;

    const stopHits = tokens.filter((token) => STOPWORDS.has(token)).length;
    const firstPersonHits = tokens.filter((token) => FIRST_PERSON.has(token)).length;
    const secondPersonHits = tokens.filter((token) => SECOND_PERSON.has(token)).length;
    const contractionHits = tokens.filter((token) => token.includes("'")).length;
    const numberHits = tokens.filter((token) => /\d/.test(token)).length;
    const stopwordRatio = wordCount ? stopHits / wordCount : 0;

    const buzzHits = countPhraseHits(cleaned, PHRASES.buzz);
    const hedgeHits = countPhraseHits(cleaned, PHRASES.hedge);
    const transitionHits = countPhraseHits(cleaned, PHRASES.transition);
    const templateHits = countPhraseHits(cleaned, PHRASES.template);

    const punctuationCounts = {
      comma: (cleaned.match(/,/g) || []).length,
      colon: (cleaned.match(/:/g) || []).length,
      semicolon: (cleaned.match(/;/g) || []).length,
      exclamation: (cleaned.match(/!/g) || []).length,
      question: (cleaned.match(/\?/g) || []).length,
      ellipsis: (cleaned.match(/(?:\.\.\.|…)/g) || []).length,
      quote: (cleaned.match(/["'“”‘’]/g) || []).length,
      parenthesis: (cleaned.match(/[()]/g) || []).length
    };
    const punctuationVariety = Object.values(punctuationCounts).filter((count) => count > 0).length / 8;

    const lines = raw.split('\n');
    const listMarkerCount = lines.filter((line) => /^\s*(?:•|-|\*|\d+[.)])\s+/.test(line)).length;
    const newlineCount = (raw.match(/\n/g) || []).length;
    const urlCount = (cleaned.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) || []).length;
    const mentionCount = (cleaned.match(/@\w+|(?:^|\s)\/?[ur]\/[A-Za-z0-9_-]+/g) || []).length;
    const hashtagCount = (cleaned.match(/#\w+/g) || []).length;

    const originalWords = raw.split(/\s+/).filter(Boolean);
    let properNounish = 0;
    for (let index = 1; index < originalWords.length; index += 1) {
      const word = originalWords[index].replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
      const previous = originalWords[index - 1];
      if (/^[A-Z][a-z]+/.test(word) && !/[.!?]$/.test(previous)) properNounish += 1;
    }

    const per100 = (count) => wordCount ? count * 100 / wordCount : 0;
    const language = languageSupport(raw, tokens, stopwordRatio);
    const features = {
      typeTokenRatio: clamp(typeTokenRatio, 0, 1),
      mattr25: clamp(mattr25, 0, 1),
      sentenceLenCV: clamp(sentenceLenCV / 2, 0, 1),
      avgSentenceLen: clamp(avgSentenceLen / 40, 0, 1),
      wordLenCV: clamp(wordLenCV, 0, 1),
      paragraphLenCV: clamp(paragraphLenCV / 2, 0, 1),
      bigramRepeatRatio: clamp(repeatedNgramRatio(tokens, 2), 0, 1),
      trigramRepeatRatio: clamp(repeatedNgramRatio(tokens, 3), 0, 1),
      sentenceStarterRepeatRatio: clamp(sentenceStarterRepeatRatio, 0, 1),
      charTrigramRepeatRatio: clamp(characterTrigramRepeatRatio(cleaned), 0, 1),
      stopwordRatio: clamp(stopwordRatio, 0, 1),
      hapaxRatio: clamp(hapaxRatio, 0, 1),
      topWordShare: clamp(topWordShare, 0, 1),
      contractionRatio: clamp(wordCount ? contractionHits / wordCount : 0, 0, 1),
      firstPersonRatio: clamp(wordCount ? firstPersonHits / wordCount : 0, 0, 1),
      secondPersonRatio: clamp(wordCount ? secondPersonHits / wordCount : 0, 0, 1),
      shortSentenceRatio: clamp(shortSentenceRatio, 0, 1),
      listMarkerCount: clamp(listMarkerCount / 4, 0, 1),
      newlineRatio: clamp((newlineCount / Math.max(1, raw.length)) / 0.15, 0, 1),
      discoursePer100w: clamp(per100(transitionHits) / 10, 0, 1),
      templatePer100w: clamp(per100(templateHits) / 6, 0, 1),
      buzzPer100w: clamp(per100(buzzHits) / 6, 0, 1),
      aiHedgePresent: hedgeHits > 0 ? 1 : 0,
      commaPer100w: clamp(per100(punctuationCounts.comma) / 30, 0, 1),
      colonPer100w: clamp(per100(punctuationCounts.colon) / 10, 0, 1),
      semicolonPer100w: clamp(per100(punctuationCounts.semicolon) / 6, 0, 1),
      exclamationsPer100w: clamp(per100(punctuationCounts.exclamation) / 6, 0, 1),
      questionsPer100w: clamp(per100(punctuationCounts.question) / 6, 0, 1),
      ellipsisPer100w: clamp(per100(punctuationCounts.ellipsis) / 4, 0, 1),
      quoteRatio: clamp((punctuationCounts.quote / Math.max(1, charCount)) / 0.08, 0, 1),
      parenRatio: clamp((punctuationCounts.parenthesis / Math.max(1, charCount)) / 0.08, 0, 1),
      punctuationVariety: clamp(punctuationVariety, 0, 1),
      emojiPresent: emojiRe.test(cleaned) ? 1 : 0
    };

    return {
      cleaned,
      tokens,
      features,
      charNgrams: hashedCharacterNgrams(cleaned, CHAR_HASH_DIM),
      metrics: {
        wordCount,
        charCount,
        sentenceCount,
        avgSentenceLen,
        sentenceLenCV,
        wordLenCV,
        paragraphLenCV,
        typeTokenRatio,
        mattr25,
        hapaxRatio,
        stopwordRatio,
        bigramRepeatRatio: repeatedNgramRatio(tokens, 2),
        trigramRepeatRatio: repeatedNgramRatio(tokens, 3),
        charTrigramRepeatRatio: characterTrigramRepeatRatio(cleaned),
        sentenceStarterRepeatRatio,
        topWordShare,
        listMarkerCount,
        urlCount,
        mentionCount,
        hashtagCount,
        numberTokenRatio: wordCount ? numberHits / wordCount : 0,
        properNounishRatio: wordCount ? properNounish / wordCount : 0,
        language,
        kind: context && context.kind === 'comment' ? 'comment' : 'post'
      }
    };
  }

  function getModel(kind) {
    const key = `${platform}:${kind === 'comment' ? 'comment' : 'post'}`;
    return { key, model: modelBundle.models[key] || modelBundle.models.default || null };
  }

  function scoreExtracted(extracted, model) {
    if (!model) return { logit: 0, signal: 0.5, contributions: [], calibrated: false };
    let logit = Number(model.intercept || 0);
    const contributions = [];
    const weights = model.weights || {};
    for (const [key, coefficient] of Object.entries(weights)) {
      const value = Number(extracted.features[key] || 0);
      const contribution = Number(coefficient) * value;
      logit += contribution;
      contributions.push({ key, value, coefficient: Number(coefficient), contribution });
    }
    if (Array.isArray(model.charNgramWeights)) {
      let contribution = 0;
      const count = Math.min(model.charNgramWeights.length, extracted.charNgrams.length);
      for (let index = 0; index < count; index += 1) {
        contribution += Number(model.charNgramWeights[index] || 0) * extracted.charNgrams[index];
      }
      logit += contribution;
      contributions.push({
        key: 'hashedCharacterNgrams', value: 1, coefficient: contribution, contribution
      });
    }
    const calibration = model.calibration;
    const calibrated = Boolean(calibration && Number.isFinite(calibration.slope) && Number.isFinite(calibration.intercept));
    const signal = calibrated
      ? sigmoid(Number(calibration.slope) * logit + Number(calibration.intercept))
      : sigmoid(logit);
    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    return { logit, signal, contributions, calibrated };
  }

  function computeEvidence(metrics) {
    const platformLimits = EVIDENCE_LIMITS[platform] || EVIDENCE_LIMITS.unknown;
    const limits = platformLimits[metrics.kind] || platformLimits.post;
    const [minimum, medium, high] = limits;
    const reasons = [];
    if (metrics.language.state === 'unsupported') {
      return { level: 'insufficient', reasons: [metrics.language.reason] };
    }
    if (metrics.wordCount < minimum) {
      return { level: 'insufficient', reasons: [`only ${metrics.wordCount} words; at least ${minimum} are required`] };
    }
    let level = metrics.wordCount >= high && metrics.sentenceCount >= 3
      ? 'high'
      : metrics.wordCount >= medium ? 'medium' : 'weak';
    if (metrics.language.state === 'uncertain') reasons.push(metrics.language.reason);
    if (metrics.sentenceCount < 2) reasons.push('too little sentence variation');
    if (metrics.typeTokenRatio >= 0.9 && metrics.wordCount < 45) reasons.push('lexical diversity is unstable at this length');
    if (reasons.length && level === 'high') level = 'medium';
    else if (reasons.length && level === 'medium') level = 'weak';
    return { level, reasons };
  }

  function sensitivityThresholds(model, sensitivity) {
    const thresholds = model && model.thresholds ? model.thresholds : { moderate: 0.58, strong: 0.76 };
    const shift = sensitivity === 'conservative' ? 0.06 : sensitivity === 'aggressive' ? -0.06 : 0;
    return {
      moderate: clamp(Number(thresholds.moderate || 0.58) + shift, 0.2, 0.9),
      strong: clamp(Number(thresholds.strong || 0.76) + shift, 0.35, 1.01),
      targetFpr: thresholds.target_fpr,
      method: thresholds.method || 'unknown'
    };
  }

  function splitIntoSegments(text) {
    const pieces = normalizeText(text).match(/[^.!?\n]+(?:[.!?]+|\n+|$)/g) || [];
    const segments = [];
    let current = [];
    let count = 0;
    for (const piece of pieces) {
      const pieceCount = tokenize(piece).length;
      current.push(piece.trim());
      count += pieceCount;
      if (count >= 28) {
        segments.push(current.join(' '));
        current = [];
        count = 0;
      }
    }
    if (current.length) {
      if (segments.length && count < 15) segments[segments.length - 1] += ` ${current.join(' ')}`;
      else segments.push(current.join(' '));
    }
    return segments.filter((segment) => tokenize(segment).length >= 15).slice(0, 8);
  }

  function analyzeSegments(text, context, model, thresholds) {
    if (tokenize(text).length < 70) return { mixed: false, segments: [] };
    const segments = splitIntoSegments(text);
    if (segments.length < 2) return { mixed: false, segments: [] };
    const scored = segments.map((segment) => {
      const extracted = extractFeatures(segment, context);
      const result = scoreExtracted(extracted, model);
      return {
        signal: result.signal,
        words: extracted.metrics.wordCount,
        excerpt: segment.length > 110 ? `${segment.slice(0, 107)}…` : segment
      };
    });
    const values = scored.map((segment) => segment.signal);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const crossesBoundary = minimum < thresholds.moderate && maximum >= thresholds.strong;
    return { mixed: (maximum - minimum >= 0.25 && crossesBoundary) || maximum - minimum >= 0.38, segments: scored };
  }

  function labelAnalysis(signal, evidence, mixed, thresholds, calibrated, cueAssessment) {
    if (!calibrated) {
      return { level: cueAssessment.level, text: cueAssessment.text };
    }
    if (evidence.level === 'insufficient') {
      return { level: 'insufficient', text: 'Insufficient signal' };
    }
    if (mixed) return { level: 'mixed', text: 'Mixed AI-style signals' };
    if (signal < thresholds.moderate) return { level: 'low', text: 'Low AI-style signal' };
    if (signal < thresholds.strong || evidence.level === 'weak') {
      return { level: 'moderate', text: 'Moderate AI-style signal' };
    }
    return { level: 'strong', text: 'Strong AI-style signal' };
  }

  function analyze(rawText, context, settings) {
    const safeContext = context || { kind: 'post' };
    const safeSettings = settings || { sensitivity: 'balanced' };
    const extracted = extractFeatures(rawText, safeContext);
    const selected = getModel(extracted.metrics.kind);
    const scored = scoreExtracted(extracted, selected.model);
    const evidence = computeEvidence(extracted.metrics);
    const thresholds = sensitivityThresholds(selected.model, safeSettings.sensitivity || 'balanced');
    const segmentAnalysis = analyzeSegments(rawText, safeContext, selected.model, thresholds);
    const cueAssessment = analyzeStyleCues(rawText, extracted);
    const label = labelAnalysis(
      scored.signal,
      evidence,
      segmentAnalysis.mixed,
      thresholds,
      scored.calibrated,
      cueAssessment
    );
    const positive = scored.contributions.filter((item) => item.contribution > 0.01).slice(0, 4);
    const negative = scored.contributions.filter((item) => item.contribution < -0.01).slice(0, 4);
    const metrics = extracted.metrics;
    const counterSignals = [];
    if (metrics.urlCount) counterSignals.push(`${metrics.urlCount} link${metrics.urlCount === 1 ? '' : 's'}`);
    if (metrics.mentionCount) counterSignals.push(`${metrics.mentionCount} mention${metrics.mentionCount === 1 ? '' : 's'}`);
    if (metrics.hashtagCount) counterSignals.push(`${metrics.hashtagCount} hashtag${metrics.hashtagCount === 1 ? '' : 's'}`);
    if (metrics.numberTokenRatio >= 0.1) counterSignals.push('number-heavy text');
    if (metrics.properNounishRatio >= 0.08) counterSignals.push('many proper names');
    counterSignals.push(...evidence.reasons);

    return {
      version: ANALYSIS_VERSION,
      platform,
      kind: extracted.metrics.kind,
      modelKey: selected.key,
      modelProvenance: modelBundle.metadata && modelBundle.metadata.provenance,
      calibrated: scored.calibrated,
      cueAssessment,
      signal: scored.signal,
      signalPercent: Math.round(scored.signal * 100),
      label,
      evidence,
      thresholds,
      mixed: segmentAnalysis.mixed,
      segments: segmentAnalysis.segments,
      positiveDrivers: positive.map((item) => ({
        name: FEATURE_NAMES[item.key] || (item.key === 'hashedCharacterNgrams' ? 'character n-gram profile' : item.key),
        contribution: item.contribution
      })),
      negativeDrivers: negative.map((item) => ({
        name: FEATURE_NAMES[item.key] || item.key,
        contribution: item.contribution
      })),
      counterSignals,
      metrics,
      features: extracted.features,
      charNgrams: extracted.charNgrams,
      disclaimer: scored.calibrated
        ? 'Experimental style signal, not proof of authorship.'
        : 'Explainable cue profile, not proof of AI use or authorship.'
    };
  }

  return {
    ANALYSIS_VERSION,
    CHAR_HASH_DIM,
    analyze,
    extractFeatures,
    hashedCharacterNgrams,
    countPhraseHits,
    analyzeStyleCues,
    scoreExtracted
  };
}

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

function createPlatformAdapter() {
  'use strict';

  const postSelector = [
    'shreddit-post',
    'div[data-testid="post-container"]',
    'div.thing.link',
    'div.thing.self'
  ].join(', ');
  const commentSelector = [
    'shreddit-comment',
    'div[data-testid="comment"]',
    'div.comment'
  ].join(', ');
  const titleSelector = 'h1, h3, a.title, a[data-testid="post-title"], [slot="title"]';
  const bodySelector = [
    'div[data-click-id="text"]',
    'div[data-testid="post-content"] div[lang]',
    'div.usertext-body',
    '[slot="text"]',
    '[data-testid="post-body"]'
  ].join(', ');
  const commentTextSelector = [
    '[slot="comment"]',
    '[data-testid="comment-content"]',
    'div.usertext-body',
    'div.md'
  ].join(', ');

  function belongsTo(root, candidate, kind) {
    if (kind === 'post') {
      if (candidate.closest(commentSelector)) return false;
      const nearestShreddit = candidate.closest('shreddit-post');
      if (root.matches('shreddit-post')) return nearestShreddit === root;
      const nearestContainer = candidate.closest('div[data-testid="post-container"], div.thing.link, div.thing.self');
      return !nearestContainer || nearestContainer === root;
    }
    if (root.matches('shreddit-comment')) return candidate.closest('shreddit-comment') === root;
    if (root.matches('div[data-testid="comment"]')) {
      const shredditOwner = candidate.closest('shreddit-comment');
      if (shredditOwner && shredditOwner.contains(root)) return true;
      return candidate.closest('div[data-testid="comment"]') === root;
    }
    return candidate.closest('div.comment') === root;
  }

  function bestOwnedText(root, selector, kind) {
    let best = '';
    root.querySelectorAll(selector).forEach((candidate) => {
      if (!belongsTo(root, candidate, kind)) return;
      const text = aiHeuristicTextContent(candidate);
      if (text.length > best.length) best = text;
    });
    return best;
  }

  function postText(element) {
    const title = bestOwnedText(element, titleSelector, 'post');
    const body = bestOwnedText(element, bodySelector, 'post');
    if (title && body) {
      if (body.toLowerCase().includes(title.toLowerCase()) && title.length >= 20) return body;
      return `${title}\n${body}`;
    }
    return title || body;
  }

  return {
    id: 'reddit',
    name: 'Reddit',
    postSelector,
    commentSelector,
    isTopLevel(element, kind) {
      if (kind === 'post') {
        const parentPost = element.parentElement && element.parentElement.closest(postSelector);
        return !parentPost && !element.closest(commentSelector);
      }
      if (element.matches('div[data-testid="comment"]') && element.closest('shreddit-comment')) return false;
      return true;
    },
    extractText(element, kind) {
      return kind === 'comment' ? bestOwnedText(element, commentTextSelector, 'comment') : postText(element);
    },
    placeBadge(element, badge, kind) {
      if (kind === 'comment') {
        const tagline = element.querySelector('p.tagline');
        if (tagline) {
          tagline.appendChild(badge);
          return;
        }
        const header = element.querySelector('[data-testid="comment_author_link"], [data-testid="comment-author-link"], header');
        if (header && header.parentElement) {
          header.parentElement.appendChild(badge);
          return;
        }
      }
      const oldTitle = element.querySelector('a.title');
      if (oldTitle && oldTitle.parentElement) {
        oldTitle.parentElement.insertBefore(badge, oldTitle.nextSibling);
        return;
      }
      const header = element.querySelector('[data-testid="post-author-link"], header, h1, h3');
      if (header && header.parentElement) {
        header.parentElement.appendChild(badge);
        return;
      }
      element.insertBefore(badge, element.firstChild);
    }
  };
}

  startAIHeuristic(createPlatformAdapter(), AI_HEURISTIC_MODELS);
})();
