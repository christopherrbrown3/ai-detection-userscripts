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
      modelAvailable: Boolean(selected.model),
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
