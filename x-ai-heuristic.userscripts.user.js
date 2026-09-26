// Generated file. Edit src/, models/default-models.json, or scripts/build_userscripts.py instead.
// Installation and documentation: https://github.com/christopherrbrown3/ai-detection-userscripts

// ==UserScript==
// @name         X AI-Style Signal (Local)
// @namespace    https://github.com/christopherrbrown3/ai-detection-userscripts
// @version      0.4.0
// @description  Adds an experimental, privacy-preserving AI-style signal to X/Twitter posts and replies.
// @author       christopherrbrown3
// @license      MIT
// @homepageURL  https://github.com/christopherrbrown3/ai-detection-userscripts
// @supportURL   https://github.com/christopherrbrown3/ai-detection-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/x-ai-heuristic.userscripts.user.js
// @updateURL    https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/x-ai-heuristic.userscripts.user.js
// @match        https://x.com/*
// @match        https://www.x.com/*
// @match        https://twitter.com/*
// @match        https://www.twitter.com/*
// @run-at       document-idle
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const AI_HEURISTIC_MODELS = {"schema_version":2,"metadata":{"version":"0.2.0","calibrated":false,"provenance":"Hand-tuned experimental baseline retained for continuity. Replace with offline-trained and held-out calibrated models before treating scores as probabilities.","feature_set":"stylometry-v3-charhash128"},"models":{"x:post":{"intercept":-0.25,"weights":{"aiHedgePresent":2.1,"templatePer100w":0.7,"discoursePer100w":0.55,"bigramRepeatRatio":1.0,"trigramRepeatRatio":0.6,"sentenceStarterRepeatRatio":0.5,"buzzPer100w":0.4,"mattr25":-0.7,"sentenceLenCV":-0.7,"avgSentenceLen":0.5,"wordLenCV":-0.15,"contractionRatio":-0.18,"colonPer100w":0.18,"commaPer100w":0.15,"exclamationsPer100w":0.2,"questionsPer100w":0.12,"topWordShare":0.25},"calibration":null,"thresholds":{"moderate":0.58,"strong":0.76,"target_fpr":null,"method":"experimental-default"}},"x:comment":{"intercept":-0.35,"weights":{"aiHedgePresent":2.0,"templatePer100w":0.65,"discoursePer100w":0.45,"bigramRepeatRatio":0.9,"trigramRepeatRatio":0.5,"sentenceStarterRepeatRatio":0.45,"mattr25":-0.65,"sentenceLenCV":-0.65,"avgSentenceLen":0.45,"wordLenCV":-0.12,"contractionRatio":-0.18,"exclamationsPer100w":0.18,"topWordShare":0.22},"calibration":null,"thresholds":{"moderate":0.6,"strong":0.78,"target_fpr":null,"method":"experimental-default"}}}};

function createDetectorEngine(options) {
  'use strict';

  const config = options || {};
  const platform = config.platform || 'unknown';
  const modelBundle = config.modelBundle || { metadata: {}, models: {} };
  const CHAR_HASH_DIM = 128;
  const ANALYSIS_VERSION = 'browser-cues-v3';

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
      'as an ai', 'as a language model', 'as an artificial intelligence',
      'i am an ai', "i'm an ai", 'i am a language model'
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

  // One deterministic parser is shared by cues, metrics and segment diagnostics.
  // Keep UTF-16 offsets so excerpts can highlight the exact normalized source.
  function parseText(text) {
    const raw = normalizeText(text);
    const excluded = [];
    const exclusionRe = /\x60{3}[\s\S]*?(?:\x60{3}|$)|\x60[^\x60\n]+\x60|^>[^\n]*|“[^”]*”|"[^"\n]*"|‘[^’\n]+’|(?<![\p{L}\p{N}])'[^'\n]+'(?![\p{L}\p{N}])/gmu;
    const masked = raw.replace(exclusionRe, (value, offset) => {
      excluded.push({ start: offset, end: offset + value.length, kind: value.charCodeAt(0) === 96 ? 'code' : 'quotes' });
      return value.replace(/[^\n]/g, ' ');
    });
    const sentences = [];
    const boundaryRe = /[.!?]+(?:[)\]]+)?(?=\s|$)|\n+/g;
    const abbreviations = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'u.s', 'u.k']);
    let start = 0;
    function append(end) {
      const piece = masked.slice(start, end);
      const leading = piece.length - piece.trimStart().length;
      const trimmed = piece.trim();
      const tokens = tokenize(trimmed);
      if (tokens.length) {
        const offset = start + leading;
        const lineStart = masked.lastIndexOf('\n', offset - 1) + 1;
        sentences.push({
          text: trimmed, start: offset, end: offset + trimmed.length, tokens,
          length: tokens.length,
          isList: /^\s*(?:[-*•]|\d+[.)])\s+/.test(masked.slice(lineStart))
        });
      }
      start = end;
    }
    let match;
    while ((match = boundaryRe.exec(masked))) {
      if (match[0] === '.') {
        const prefix = masked.slice(start, match.index);
        const word = (prefix.match(/([A-Za-z.]+)$/) || [])[1] || '';
        if (abbreviations.has(word.toLowerCase()) || /^[A-Z]$/.test(word) || /^\s*\d+$/.test(prefix)) continue;
      }
      append(match.index + match[0].length);
    }
    append(masked.length);
    return { raw, masked, sentences, excluded };
  }

  function phraseSpans(parsed, phrases) {
    const normalized = normalizeApostrophes(parsed.masked);
    const spans = [];
    for (const phrase of phrases) {
      const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + escapeRegExp(phrase).replace(/ /g, '[ \\t]+') + ')(?=$|[^\\p{L}\\p{N}])', 'giu');
      let match;
      while ((match = re.exec(normalized))) {
        const start = match.index + match[1].length;
        const end = start + match[2].length;
        if (!parsed.excluded.some((span) => start < span.end && end > span.start)) {
          spans.push({ start, end });
        }
      }
    }
    return spans.sort((a, b) => a.start - b.start || b.end - a.end)
      .filter((span, index, all) => !all.slice(0, index).some((prior) => prior.start <= span.start && prior.end >= span.end));
  }

  function tokensWithOffsets(sentence) {
    const spans = [];
    const re = new RegExp(unicodeWordRe.source, 'gu');
    let match;
    while ((match = re.exec(sentence.text))) {
      spans.push({ word: normalizeApostrophes(match[0]).toLowerCase(), start: sentence.start + match.index, end: sentence.start + match.index + match[0].length });
    }
    return spans;
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

  function heuristicCoverage(metrics) {
    if (metrics.language.state === 'unsupported') {
      return { level: 'unsupported', text: 'Unsupported language', reason: metrics.language.reason };
    }
    if (metrics.language.state === 'uncertain') {
      return { level: 'uncertain', text: 'Language uncertain', reason: metrics.language.reason };
    }
    if (metrics.wordCount < 20 || metrics.sentenceCount < 2) {
      return { level: 'short', text: 'Short sample', reason: 'Fewer than 20 words or 2 sentences; patterns may be incidental.' };
    }
    if (metrics.wordCount >= 80 && metrics.sentenceCount >= 4) {
      return { level: 'long', text: 'Long sample', reason: 'At least 80 words and 4 sentences.' };
    }
    return { level: 'standard', text: 'Standard sample', reason: 'At least 20 words and 2 sentences.' };
  }

  function analyzeStyleCues(rawText, extracted) {
    const parsed = extracted.parsed || parseText(rawText);
    const raw = parsed.masked;
    const coverage = heuristicCoverage(extracted.metrics);
    const families = [];
    const assessed = !['unsupported', 'uncertain'].includes(coverage.level);
    const prose = parsed.sentences.filter((sentence) => !sentence.isList);
    const proseTokens = prose.map(tokensWithOffsets);
    const proseWordCount = prose.reduce((sum, sentence) => sum + sentence.length, 0);
    function add(id, name, detail, spans) {
      families.push({ id, name, detail, spans: spans.slice(0, 8) });
    }

    if (assessed) {
      const references = phraseSpans(parsed, PHRASES.hedge);
      if (references.length) {
        add('self-disclosure', 'Explicit model reference', 'Model-reference wording outside quotations or code.', references);
      }

      const framing = phraseSpans(parsed, [...PHRASES.template, ...PHRASES.transition, ...PHRASES.rhetorical]);
      const buzz = phraseSpans(parsed, PHRASES.buzz);
      // One everyday phrase or promotional adjective is too little to flag.
      const distinctFraming = new Set(framing.map((span) => normalizeApostrophes(raw.slice(span.start, span.end)).toLowerCase()));
      const distinctBuzz = new Set(buzz.map((span) => raw.slice(span.start, span.end).toLowerCase()));
      if (distinctFraming.size >= 2 || (distinctFraming.size && distinctBuzz.size >= 2)) {
        add('formulaic-framing', 'Stock framing phrases',
          distinctFraming.size + ' distinct framing phrases; ' + distinctBuzz.size + ' promotional terms.',
          [...framing, ...buzz].sort((a, b) => a.start - b.start));
      }

      const openingGroups = new Map();
      for (const tokens of proseTokens) {
        if (tokens.length < 2) continue;
        const first = tokens.slice(0, 2);
        if (first.every((token) => STOPWORDS.has(token.word))) continue;
        if (parsed.excluded.some((span) => first[0].start < span.end && first[1].end > span.start)) continue;
        const key = first.map((token) => token.word).join(' ');
        if (!openingGroups.has(key)) openingGroups.set(key, []);
        openingGroups.get(key).push({ start: first[0].start, end: first[1].end });
      }
      const repeatedOpenings = Array.from(openingGroups.values())
        .filter((spans) => spans.length >= 2 && spans.length / Math.max(1, prose.length) >= 0.3);
      for (const spans of repeatedOpenings) {
        const groups = spans.map((span) => proseTokens.find((tokens) => tokens[0] && tokens[0].start === span.start));
        let sharedLength = 2;
        while (sharedLength < 8 && groups.every((tokens) => tokens[sharedLength] &&
          tokens[sharedLength].word === groups[0][sharedLength].word &&
          !parsed.excluded.some((span) => tokens[0].start < span.end && tokens[sharedLength].end > span.start))) sharedLength += 1;
        spans.forEach((span, index) => { span.end = groups[index][sharedLength - 1].end; });
      }
      const openingSpans = repeatedOpenings.flat();
      if (prose.length >= 3 && openingSpans.length) {
        add('repeated-openings', 'Repeated sentence openings',
          openingSpans.length + ' of ' + prose.length + ' prose sentences reuse a multiword opening.', openingSpans);
      }

      const listSpans = Array.from(raw.matchAll(/^\s*(?:[-*•]|\d+[.)])\s+[^\n]+/gm), (match) => ({
        start: match.index + match[0].length - match[0].trimStart().length,
        end: match.index + match[0].length
      }));
      const punctuation = Array.from(raw.matchAll(/:(?!\/\/)|[—–]/g), (match) => ({ start: match.index, end: match.index + 1 }));
      const colons = punctuation.filter((span) => raw[span.start] === ':').length;
      const dashes = (raw.match(/[—–]/g) || []).length;
      if (listSpans.length >= 3 || (extracted.metrics.wordCount >= 30 &&
        ((colons >= 2 && dashes >= 1) || dashes >= 3) &&
        punctuation.length * 100 / extracted.metrics.wordCount >= 4)) {
        add('structured-presentation', 'List and punctuation structure',
          listSpans.length + ' list items; ' + colons + ' colons; ' + dashes + ' dashes.',
          listSpans.length >= 3 ? listSpans : punctuation);
      }

      const lengths = prose.map((sentence) => sentence.length);
      const variation = coefficientOfVariation(lengths);
      if (prose.length >= 5 && proseWordCount >= 40 && variation <= 0.28) {
        add('sentence-uniformity', 'Similar sentence lengths',
          'Prose sentence lengths: ' + lengths.slice(0, 12).join(', ') +
          (lengths.length > 12 ? ', …' : '') + ' words. Variation: ' + variation.toFixed(2) + '. List items are excluded.',
          prose.map(({ start, end }) => ({ start, end })));
      }

      // Actual contiguous spans, never pairs invented by deleting stopwords.
      const patterns = new Map();
      for (const tokens of proseTokens) {
        for (let size = 5; size >= 3; size -= 1) {
          for (let index = 0; index <= tokens.length - size; index += 1) {
            const words = tokens.slice(index, index + size);
            if (words.every((token) => STOPWORDS.has(token.word))) continue;
            const start = words[0].start;
            const end = words[words.length - 1].end;
            if (parsed.excluded.some((span) => start < span.end && end > span.start)) continue;
            if (families.some((family) => family.id === 'repeated-openings') &&
              openingSpans.some((span) => start < span.end && end > span.start)) continue;
            const key = words.map((token) => token.word).join(' ');
            if (!patterns.has(key)) patterns.set(key, { size, spans: [] });
            const candidate = patterns.get(key);
            if (!candidate.spans.length || start >= candidate.spans[candidate.spans.length - 1].end) {
              candidate.spans.push({ start, end });
            }
          }
        }
      }
      const repetitions = Array.from(patterns.values()).filter((pattern) => pattern.spans.length >= 2)
        .sort((a, b) => b.size - a.size || b.spans.length - a.spans.length);
      const selected = [];
      const used = [];
      let repeatedWords = 0;
      for (const pattern of repetitions) {
        const available = pattern.spans.filter((span) => !used.some((prior) => span.start < prior.end && span.end > prior.start));
        if (available.length < 2) continue;
        selected.push(...available);
        used.push(...available);
        repeatedWords += (available.length - 1) * pattern.size;
        if (selected.length >= 8) break;
      }
      const repetitionRate = repeatedWords / Math.max(1, proseWordCount);
      if (proseWordCount >= 40 && repetitionRate >= 0.08) {
        add('content-repetition', 'Repeated phrases',
          Math.round(repetitionRate * 100) + '% of prose words repeat an earlier 3–5-word phrase. List items and counted openings are excluded.', selected);
      }
    }
    const level = !assessed ? 'unassessed' : families.length === 0 ? 'cue-none' : families.length === 1 ? 'cue-one' : 'cue-multiple';
    return {
      level, text: assessed ? families.length + ' matched' : 'Not assessed',
      families, totalFamilies: 6, coverage, assessed
    };
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

  function languageSupport(rawText, tokens) {
    const letters = rawText.match(unicodeLetterRe) || [];
    if (!letters.length) return { state: 'unsupported', latinRatio: 0, reason: 'no letter evidence' };
    const latinLetters = (rawText.match(/[A-Za-z]/g) || []).length;
    const latinRatio = latinLetters / letters.length;
    if (latinRatio < 0.72) {
      return { state: 'unsupported', latinRatio, reason: 'non-Latin or mixed-script text' };
    }
    const sharedWords = new Set(['a', 'an', 'i', 'no', 'me', 'so', 'he', 'be', 'on']);
    const englishWords = tokens.filter((token) => STOPWORDS.has(token) && !sharedWords.has(token));
    if (new Set(englishWords).size < 2 || englishWords.length / Math.max(1, tokens.length) < 0.1) {
      return { state: 'uncertain', latinRatio, reason: 'Too little English language evidence for these English cue rules.' };
    }
    return { state: 'supported', latinRatio, reason: '' };
  }

  function extractFeatures(rawText, context, options) {
    const parsed = parseText(rawText);
    const raw = parsed.masked;
    const cleaned = raw.replace(/\s+/g, ' ');
    const tokens = tokenize(cleaned);
    const wordCount = tokens.length;
    const charCount = cleaned.length;

    const sentenceTexts = parsed.sentences.map((sentence) => sentence.text);
    const sentenceLengths = parsed.sentences.map((sentence) => sentence.length);
    const sentenceCount = sentenceLengths.length;
    const avgSentenceLen = mean(sentenceLengths) || wordCount;
    const sentenceLenCV = coefficientOfVariation(sentenceLengths);
    if (options && options.lightweight) {
      return {
        parsed, cleaned, tokens,
        metrics: {
          wordCount, charCount, sentenceCount, avgSentenceLen, sentenceLenCV,
          typeTokenRatio: wordCount ? new Set(tokens).size / wordCount : 0,
          language: languageSupport(raw, tokens),
          kind: context && context.kind === 'comment' ? 'comment' : 'post'
        }
      };
    }
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
    const language = languageSupport(raw, tokens);
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
      parsed,
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
    const pieces = parseText(text).sentences.map((sentence) => sentence.text);
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

  function analyze(rawText, context, settings, options) {
    const safeContext = context || { kind: 'post' };
    const safeSettings = settings || { sensitivity: 'balanced' };
    const selected = getModel(safeContext.kind);
    const calibration = selected.model && selected.model.calibration;
    const calibrated = Boolean(calibration && Number.isFinite(calibration.slope) && Number.isFinite(calibration.intercept));
    const lightweight = !calibrated && !(options && options.diagnostics);
    const extracted = extractFeatures(rawText, safeContext, { lightweight });
    const cueAssessment = analyzeStyleCues(rawText, extracted);
    const excluded = { quotes: 0, code: 0, ...(safeContext.excluded || {}) };
    for (const span of extracted.parsed.excluded) excluded[span.kind] += 1;
    const shared = {
      sourceText: extracted.parsed.raw, excluded,
      context: safeContext, cueAssessment, metrics: extracted.metrics
    };
    if (lightweight) {
      let diagnostics;
      return {
        ...shared, version: ANALYSIS_VERSION, platform, kind: extracted.metrics.kind,
        modelKey: selected.key, calibrated: false,
        label: { level: cueAssessment.level, text: cueAssessment.text },
        signal: null, signalPercent: null, segments: [], mixed: false,
        evidence: computeEvidence(extracted.metrics),
        getDiagnostics() {
          if (!diagnostics) diagnostics = analyze(rawText, safeContext, safeSettings, { diagnostics: true });
          return diagnostics;
        },
        disclaimer: 'Style patterns do not establish authorship.'
      };
    }
    const scored = scoreExtracted(extracted, selected.model);
    const evidence = computeEvidence(extracted.metrics);
    const thresholds = sensitivityThresholds(selected.model, safeSettings.sensitivity || 'balanced');
    const segmentAnalysis = options && options.diagnostics && scored.calibrated
      ? analyzeSegments(extracted.parsed.masked, safeContext, selected.model, thresholds)
      : { mixed: false, segments: [] };
    const label = !cueAssessment.assessed ? { level: 'unassessed', text: 'Not assessed' } : labelAnalysis(
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
      ...shared,
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
    parseText,
    analyzeStyleCues,
    scoreExtracted
  };
}

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

function createPlatformAdapter() {
  'use strict';

  const postSelector = 'article[role="article"]';
  const commentSelector = 'article[role="article"]';

  function isReply(element) {
    return Array.from(element.querySelectorAll('div[data-testid="socialContext"]'))
      .some((context) => /replying to/i.test(aiHeuristicTextContent(context)));
  }

  function tweetText(element) {
    let best = null;
    let quotes = 0;
    element.querySelectorAll('div[data-testid="tweetText"]').forEach((candidate) => {
      if (candidate.closest('article[role="article"]') !== element) return;
      const quote = candidate.closest('[data-testid="quoteTweet"], [data-testid="card.wrapper"], div[role="link"]');
      if (quote && element.contains(quote)) { quotes += 1; return; }
      if (!best) best = aiHeuristicReadContent(candidate);
    });
    best = best || { text: '', excluded: { quotes: 0, code: 0 } };
    best.excluded.quotes += quotes;
    return best;
  }

  return {
    id: 'x',
    name: 'X / Twitter',
    postSelector,
    commentSelector,
    kindForElement(element) {
      return isReply(element) ? 'comment' : 'post';
    },
    isTopLevel(element) {
      return !(element.parentElement && element.parentElement.closest(postSelector));
    },
    extractContent(element) {
      return tweetText(element);
    },
    placeBadge(element, badge) {
      const header = element.querySelector('div[data-testid="User-Name"]');
      if (header) {
        header.appendChild(badge);
        return;
      }
      const text = element.querySelector('div[data-testid="tweetText"]');
      if (text && text.parentElement) {
        text.parentElement.insertBefore(badge, text);
        return;
      }
      element.insertBefore(badge, element.firstChild);
    }
  };
}

  startAIHeuristic(createPlatformAdapter(), AI_HEURISTIC_MODELS);
})();
