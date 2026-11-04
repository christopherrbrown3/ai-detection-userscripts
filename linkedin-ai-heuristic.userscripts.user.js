// Generated file. Edit src/, models/, or scripts/build_userscripts.py instead.
// Installation and documentation: https://github.com/christopherrbrown3/ai-detection-userscripts

// ==UserScript==
// @name         LinkedIn AI-Style Signal (Local)
// @namespace    https://github.com/christopherrbrown3/ai-detection-userscripts
// @version      0.10.0
// @description  Adds an experimental, privacy-preserving AI-style signal to LinkedIn posts and comments.
// @author       christopherrbrown3
// @license      MIT
// @homepageURL  https://github.com/christopherrbrown3/ai-detection-userscripts
// @supportURL   https://github.com/christopherrbrown3/ai-detection-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/linkedin-ai-heuristic.userscripts.user.js
// @updateURL    https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/linkedin-ai-heuristic.userscripts.user.js
// @match        https://www.linkedin.com/*
// @match        https://linkedin.com/*
// @match        https://*.linkedin.com/*
// @match        https://m.linkedin.com/*
// @run-at       document-idle
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

function createDetectorEngine(options) {
  'use strict';

  const config = options || {};
  const platform = config.platform || 'unknown';
  const modelBundle = config.modelBundle || { metadata: {}, models: {} };
  const CHAR_HASH_DIM = 128;
  const ANALYSIS_VERSION = 'browser-cues-v6';

  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'because', 'so', 'of', 'to', 'in', 'on',
    'for', 'with', 'by', 'as', 'at', 'from', 'that', 'this', 'these', 'those', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
    'i', 'me', 'my', 'he', 'his', 'she', 'her', 'not', 'no', 'yes', 'do', 'does', 'did', 'can',
    'could', 'would', 'should', 'may', 'might', 'must', 'will', 'just', 'have', 'has', 'had'
  ]);

  // Language-gate evidence only; STOPWORDS also feeds diagnostic features.
  // Contractions keep punchy, contraction-heavy English from reading as
  // "uncertain" (it's, don't and isn't were not English evidence before 0.10).
  const ENGLISH_EVIDENCE = new Set([...STOPWORDS,
    "it's", "don't", "isn't", "i'm", "you're", "that's", "can't", "won't", "didn't", "doesn't", "aren't", "wasn't",
    "we're", "they're", "there's", "what's", "let's", "i've", "i'll", "i'd", "you'll", "you've", "we've", "it'll",
    'about', 'what', 'there', 'all', 'very', 'really', 'more', 'most', 'some', 'any', 'how', 'why', 'when', 'where',
    'who', 'which', 'than', 'only', 'also', 'into', 'out', 'up', 'over', 'every'
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

  // Cue-only framing additions do not change the diagnostic model vocabulary.
  const FRAMING_CUES = [
    'the real question is', 'the real challenge is', 'the real magic',
    'here is the truth', "here's the truth", 'the answer is simple',
    'a powerful reminder', 'a testament to',
    'in a world where', "in today's fast-paced world", 'in an ever-changing world',
    'at its core', 'the key takeaway', 'the key to success', 'it all comes down to',
    'excited to share', 'game changer', 'unlock the power', 'unlock your potential', 'take it to the next level',
    'redefining the way', 'the possibilities are endless'
  ];

  // Cue-only phrase tiers. PHRASES above feeds the diagnostic model and must
  // stay in sync with training/features.py; these lists never change features.
  // Weak phrases were about as common in pre-2022 human answers as in ChatGPT
  // output (HC3 ELI5, docs/accuracy-validation.md), so they count only in threes.
  const WEAK_FRAMING = [
    'here are', 'that said', 'in other words', 'as a result', 'in addition',
    'on the other hand', 'what i learned', 'furthermore', 'moreover',
    'at the end of the day', 'what this means', 'as such', 'to be clear', 'in this thread',
    'the question is', 'the reality is', 'step by step', 'lessons learned', 'in the meantime',
    "here's how", 'here is how', "it's not about", 'with that in mind', 'to sum up', 'overall',
    'additionally', "here's the thing", "here's what", 'here is what', 'the lesson', 'in this post',
    'make no mistake'
  ];
  // Assistant-register framing that was rare in the same human control set.
  const EXTRA_FRAMING = [
    'overall,', "it's important to", 'it is important to', "it's also important", 'it is also important',
    "it's worth noting", "it's crucial to", 'it is crucial to', 'in summary', 'in conclusion',
    'there are many factors', 'there are several factors', 'a number of factors', 'a wide range of',
    'a wide variety of', 'a wide array of', "it's always a good idea", 'it is always a good idea',
    'it is not uncommon', 'it can be helpful', 'there is no one-size-fits-all', 'i hope this helps',
    'let me know if you have any questions', 'let me know if you have any other questions',
    'based on available information', 'based on the available information', 'while specific details are limited',
    'in the realm of', 'navigating the complexities', 'in an ever-evolving'
  ];
  // Inflection-aware promotional terms (regex sources); "leverage" also
  // matches "leveraging". One distinct term counts once.
  const BUZZ_TERMS = [
    'synerg(?:y|ies|istic)', 'leverag(?:e|es|ed|ing)', 'unlock(?:s|ed|ing)?', 'paradigms?', 'disrupt(?:s|ed|ing|ive|ion)?',
    'innovative', 'thought leadership', 'game(?:-| )changers?', 'empower(?:s|ed|ing|ment)?', 'elevat(?:e|es|ed|ing)',
    'journeys?', 'mission', 'vision', 'stakeholders?', 'scalable', 'robust', 'strategic', 'amazing', 'incredible',
    'excited to announce', 'thrilled to', 'grateful for', 'honou?red to', 'humbled?', 'delighted to share', 'proud to'
  ];
  // Style words over-represented in LLM output: Wikipedia "Signs of AI writing",
  // Kobak et al. 2025 (excess vocabulary) and Reinhart et al. 2025 (PNAS).
  // Each appeared in at most 0.17% of pre-2022 human HC3 answers.
  const AI_VOCABULARY = [
    'delv(?:e|es|ed|ing)', 'tapestr(?:y|ies)', 'testament', 'pivotal', 'underscor(?:es|ed|ing)', 'showcas(?:e|es|ed|ing)',
    'intricate(?:ly)?', 'intricac(?:y|ies)', 'vibrant', 'enduring', 'foster(?:s|ed|ing)?', 'garner(?:s|ed|ing)?',
    'meticulous(?:ly)?', 'interplay', 'boasts', 'bolster(?:s|ed|ing)?', 'multifaceted', 'realms?', 'commendable',
    'noteworthy', 'notably', 'embark(?:s|ed|ing)?', 'resonat(?:e|es|ed|ing)', 'transformative', 'unwavering',
    'holistic', 'invaluable', 'seamless(?:ly)?', 'camaraderie', 'palpable', 'insightful', 'groundbreaking',
    'cutting-edge', 'elucidat(?:e|es|ed|ing)', 'underpin(?:s|ned|ning)?', 'encompass(?:es|ed|ing)?', 'ever-evolving',
    'unparalleled', 'esteemed', 'adept', 'exemplif(?:y|ies|ied)', 'myriad', 'plethora', 'bustling', 'beacon',
    'symphony', 'labyrinth', 'kaleidoscope', 'treasure trove', 'pinnacle', 'quintessential', 'indelible',
    'nestled', 'enigmatic', 'paramount', 'nuanced', 'thriving', 'navigat(?:e|es|ed|ing)', 'landscapes?',
    'comprehensive', 'crucial(?:ly)?', 'harness(?:es|ed|ing)?', 'streamlin(?:e|es|ed|ing)', 'embrac(?:e|es|ed|ing)'
  ];
  // Copula avoidance and trailing participle clauses (Wikipedia "Signs of AI
  // writing"); a regex stand-in for the present participial clauses that
  // Reinhart et al. found at 2-5x the human rate in instruction-tuned output.
  const LLM_PHRASING = [
    '(?:serves|served|serving|stands|stood) as (?:a|an|the)', '(?:is|are|was|remains|stands as) a testament to',
    '(?:plays?|played|playing) (?:a|an) (?:crucial|pivotal|vital|key|significant|essential|integral|important) role',
    ', (?:highlighting|underscoring|emphasizing|showcasing|reflecting|symbolizing|ensuring|fostering|enhancing|solidifying|cementing|reinforcing|paving the way)',
    '(?:a|an) (?:rich|vibrant|intricate|complex|diverse) tapestry', 'setting the stage for',
    '(?:evolving|ever-changing|ever-evolving|rapidly changing) landscape', 'deeply rooted',
    '(?:a|the) (?:crucial|pivotal|key) (?:moment|turning point)', 'left an indelible mark'
  ];

  // How chat models write when asked for a social post: forum-caricature
  // greetings, request/thanks formulas and confessional set-ups. Mined from
  // half of RAID's Reddit posts (GPT-4, Llama-2-chat, Mistral-chat, MPT-chat)
  // and checked on the other half; ordinary people use several of these, so
  // two distinct phrases are required (docs/accuracy-validation.md).
  const CHATBOT_REGISTER = [
    'fellow redditors', 'hey everyone', 'hi everyone', 'hello everyone', 'thanks in advance', 'thank you in advance',
    'would be greatly appreciated', 'would be much appreciated', 'any advice would be', 'any insights would be',
    'advice or suggestions', 'insights or advice', 'thoughts or advice', 'tips or advice', 'advice or recommendations',
    'words of encouragement', 'thanks for reading', 'thank you for reading', 'looking forward to hearing', "i'm open to",
    "i'm curious to know", 'has anyone else experienced', 'has anyone else had', 'i wanted to share', "i'm reaching out",
    "i can't help but", "i've been struggling with", 'nothing seems to work', 'nothing seems to help', "it's okay to",
    "i guess i'm just", 'for a while now', "i've been feeling", 'this community', 'keep the discussion respectful',
    'on so many levels', 'challenging and rewarding', "i'm at a loss", 'any input would be', 'i would love to hear',
    "i'd love to hear", 'share your experiences', 'share your thoughts', 'feel free to share', 'in the comments below',
    // LinkedIn-style sign-offs (unmeasured: no labeled LinkedIn corpus is available).
    'what are your thoughts', "let's connect", 'drop your thoughts', "let's discuss", 'join the conversation',
    'excited to see what the future holds', 'the future is bright'
  ];

  // Line-start bullets, numbers, keycaps and emoji. The emoji ranges are
  // explicit so training/features.py can mirror them without \p classes.
  const LIST_MARKER = /^(?:[ \t]*)(?:[-*•→➜➔►▸✓✔☑✅]\uFE0F?|\d+[.)]|\d\uFE0F?\u20E3|[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF]\uFE0F?)[ \t]+/u;
  const MODEL_REFERENCE = /(?:^|[^\p{L}\p{N}])((?:as an ai(?: language model| assistant)?|as a language model|as an artificial intelligence|i am an ai(?: language model| assistant)?|i'm an ai(?: language model| assistant)?|i am a language model))(?=$|[ \t]*(?:[,;:!?.]|\b(?:i|and|but|can|cannot|do|don't|will|am|was|that|designed|trained)\b))/giu;

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
    // These end a sentence only before an uppercase word: "at 9 a.m. and", "Acme Inc. on", "No. 5".
    const conditional = new Set(['a.m', 'p.m', 'inc', 'ltd', 'co', 'corp', 'approx', 'min', 'max', 'no', 'fig', 'vol',
      'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'est', 'dept', 'govt', 'ft',
      'lb', 'lbs', 'oz', 'hr', 'hrs', 'sec', 'ave', 'blvd', 'rd', 'pp', 'ca', 'al', 'cf']);
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
          isList: LIST_MARKER.test(masked.slice(lineStart))
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
        if (conditional.has(word.toLowerCase()) && /^[ \t]*[a-z0-9]/.test(masked.slice(match.index + 1))) continue;
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

  function modelReferenceSpans(parsed) {
    const normalized = normalizeApostrophes(parsed.masked);
    return Array.from(normalized.matchAll(MODEL_REFERENCE), (match) => {
      const start = match.index + match[0].length - match[1].length;
      return { start, end: start + match[1].length };
    }).filter(({ start, end }) => !parsed.excluded.some((span) => start < span.end && end > span.start));
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

  // Fixed, documented evidence tiers. Nothing here is fitted to data:
  // definitive artifacts score 3, moderate families 1, and supporting
  // formatting cues 0.5 only when another family also matched.
  const FAMILY_INFO = {
    'self-disclosure': { tier: 'definitive', evidence: 'artifact' },
    'assistant-leftovers': { tier: 'definitive', evidence: 'artifact' },
    'markup-artifacts': { tier: 'definitive', evidence: 'artifact' },
    'ai-referral-link': { tier: 'moderate', evidence: 'artifact' },
    'formulaic-framing': { tier: 'moderate', evidence: 'word-choice' },
    'contrast-framing': { tier: 'moderate', evidence: 'word-choice' },
    'ai-vocabulary': { tier: 'moderate', evidence: 'word-choice' },
    'llm-phrasing': { tier: 'moderate', evidence: 'word-choice' },
    'chatbot-register': { tier: 'moderate', evidence: 'word-choice' },
    'repeated-openings': { tier: 'moderate', evidence: 'structure' },
    'sentence-uniformity': { tier: 'moderate', evidence: 'structure' },
    'content-repetition': { tier: 'moderate', evidence: 'structure' },
    'structured-presentation': { tier: 'supporting', evidence: 'structure' },
    'engagement-template': { tier: 'supporting', evidence: 'structure' },
    typography: { tier: 'supporting', evidence: 'structure' }
  };
  const TIER_POINTS = { definitive: 3, moderate: 1, supporting: 0.5 };
  const STAMP_POINTS = { moderate: 1, high: 3 };
  // Stamp sensitivity, chosen per site. Strict shows only moderate/high
  // stamps. Balanced (default) uses the same rules and also shows a muted
  // "Possible AI" stamp for evidence below the moderate threshold. Sensitive
  // lowers rule cut-offs, lets one rhythm/formatting family stamp, and counts
  // creator-post templates; it flags far more human posts.
  const PROFILES = {
    strict: { lowStamp: false, weakFramingMin: 3, scaleFraming: true, registerMin: 2, vocabularyMin: 3, vocabularyDensity: 1,
      phrasingMin: 2, notButWeight: 0.5, strictOpenings: true, pairStructure: true, supportingAlone: false, shortModerate: false,
      templateTier: 'supporting' },
    sensitive: { lowStamp: 'any', weakFramingMin: 1, scaleFraming: false, registerMin: 1, vocabularyMin: 2, vocabularyDensity: 0.5,
      phrasingMin: 1, notButWeight: 1, strictOpenings: false, pairStructure: false, supportingAlone: true, shortModerate: true,
      templateTier: 'moderate' }
  };
  PROFILES.balanced = { ...PROFILES.strict, lowStamp: 'evidence' };
  function profileFor(name) {
    return PROFILES[name] ? { name, ...PROFILES[name] } : { name: 'balanced', ...PROFILES.balanced };
  }

  function compileTerms(terms, literal) {
    return terms.map((term, key) => {
      const source = (literal ? escapeRegExp(term) : term).replace(/ /g, '[ \\t]+');
      const guard = term[0] === ',' ? '()' : '(^|[^\\p{L}\\p{N}])';
      return { key, re: new RegExp(guard + '(' + source + ')(?=$|[^\\p{L}\\p{N}])', 'giu') };
    });
  }

  // "TL;DR" and "if you're" were more common in human answers than in ChatGPT
  // output, so the cue rules ignore them; the diagnostic features still count them.
  const CUE_EXCLUDED = new Set(['tl;dr', 'tldr', "if you're"]);
  const FRAMING_TERMS = Array.from(new Set([
    ...PHRASES.template, ...PHRASES.transition, ...PHRASES.rhetorical, ...FRAMING_CUES, ...EXTRA_FRAMING, ...WEAK_FRAMING
  ])).filter((phrase) => !CUE_EXCLUDED.has(phrase));
  const WEAK_FRAMING_SET = new Set(WEAK_FRAMING);
  const COMPILED = {
    framing: compileTerms(FRAMING_TERMS, true),
    buzz: compileTerms(BUZZ_TERMS, false),
    vocabulary: compileTerms(AI_VOCABULARY, false),
    phrasing: compileTerms(LLM_PHRASING, false),
    register: compileTerms(CHATBOT_REGISTER, true)
  };

  const KNOWLEDGE_DISCLAIMER = /\b(?:as of my (?:last|latest|most recent) (?:knowledge |training )?(?:update|cutoff|cut-off|training(?: data)?)|my (?:knowledge|training(?: data)?) (?:cutoff|cut-off)|up to my (?:last |latest )?(?:knowledge |training )?(?:update|cutoff|cut-off)|i (?:don't|do not) have (?:access to )?(?:real-time|current|live) (?:information|data|updates)|i (?:don't|do not) have (?:the ability to browse|browsing capabilities|access to the internet)|i (?:don't|do not|cannot) have personal (?:opinions|feelings|beliefs|emotions|experiences|preferences))/gi;
  const ASSISTANT_OPENER = /^[ \t]*(?:certainly|sure|absolutely|of course)[!,.][ \t]*(?:here(?:'s| is| are)|i(?:'d| would) be (?:happy|glad) to)\b/gim;
  const DELIVERY_LINE = /^[ \t]*here(?:'s| is| are)[ \t]+(?:a|an|the|your|some|two|three|a few)[ \t]+(?:(?:revised|polished|refined|rewritten|updated|improved|shorter|longer|final|possible|sample|suggested|professional|engaging|catchy|concise|formal|casual|friendly|optimized|linkedin|twitter|reddit|facebook|instagram|youtube|social media|new|short|brief|quick)[ \t]+){0,2}(?:version|draft|post|tweet|thread|caption|reply|response|comment|message|email|bio|summary|rewrite|rewording|paraphrase)s?\b[^\n:]{0,60}:/gim;
  const ASSISTANT_SIGNOFF = /\b(?:feel free to (?:customize|adjust|modify|tweak|tailor|personalize|adapt) (?:it|this|the (?:post|message|text|caption|draft))\b[^.!\n]{0,40}?(?:further|to (?:fit|suit|match|better)|as (?:needed|you see fit)|based on)|let me know if you(?:'d| would) like (?:me to (?:make|adjust|revise|tweak|change|expand|shorten|add|modify|create|write)|any (?:changes|adjustments|modifications|revisions|tweaks|edits))|would you like me to (?:adjust|revise|make|create|expand|shorten|add|tweak|write|draft|rewrite)|i hope this (?:post|draft|caption|version) (?:helps|works|meets|resonates|captures))/gi;
  // Case-sensitive: chatbot placeholders use Title Case, while ironic human
  // asides such as "[insert joke here]" usually do not.
  const PLACEHOLDER = /\[(?:Your|Insert|Add|Enter) [A-Z][^\]\n]{0,40}\](?![ \t]*\()|\[(?:Company|Product|Brand|Event|Platform|Client|Recipient|Team|Organization|Business|Job|Website|Project|Book|Course|Industry|Location|City|Podcast|App|Service|Conference) (?:Name|Title|URL|Link|Website|Handle|Date)\]|\b(?:INSERT|PASTE)_[A-Z0-9_]+\b|\b20\d\d-(?:XX|xx)-(?:XX|xx)\b|https?:\/\/(?:www\.)?example\.com\/source\d*/g;
  const EXTRA_MARKUP = /contentReference\[oaicite:\d+\](?:\{index=\d+\})?|\[oaicite:\d+\]|【\d+(?::\d+)?†[^】\n]{0,40}】|\bcite(?:turn\d+(?:search|news|view|file|image|fetch)\d+)+|<\|(?:im_end|endoftext|eot_id)\|>/g;
  const MARKDOWN_HEADING = /^[ \t]*#{1,4}[ \t]+\p{L}[^\n]*/gmu;
  const MARKDOWN_BOLD = /\*\*(?=\S)[^*\n]{1,80}?(?<=\S)\*\*/g;
  const MARKDOWN_LINK = /\[[^\]\n]{1,80}\]\((?:https?:\/\/|www\.)[^)\s]+\)/g;
  // Wikipedia "Signs of AI writing": parameters ChatGPT, Copilot and Grok add
  // to links they cite. They show AI-tool involvement, not authorship.
  const AI_REFERRAL_TEXT = /\b(?:utm_source=(?:chatgpt\.com|openai|copilot\.com)|referrer=grok\.com)\b/gi;
  const AI_UTM_SOURCES = new Set(['chatgpt.com', 'openai', 'copilot.com']);
  const ENGAGEMENT_PROMPT = /(?:\bagree\?|\bthoughts\?|what do you think\?|what(?:'s| is| are) your\b[^\n?]{0,60}\?|how (?:do|would) you\b[^\n?]{0,60}\?|let me know in the comments|drop (?:a|your)\b[^\n]{0,40}\b(?:comment|below)|comment below|♻|\brepost\b|\bfollow (?:me|for more)\b|save this (?:post|for later)|👇)/i;

  // "Not X, but Y" surface patterns. The first ten are ported from slop-score
  // js/regexes-stage1.js (adapted: attached 's/'re and line-start anchors),
  // https://github.com/sam-paech/slop-score, under this notice:
  //   MIT License. Copyright (c) 2025 Sam Paech
  //   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
  //   associated documentation files (the "Software"), to deal in the Software without restriction,
  //   including without limitation the rights to use, copy, modify, merge, publish, distribute,
  //   sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
  //   furnished to do so, subject to the following conditions: The above copyright notice and this
  //   permission notice shall be included in all copies or substantial portions of the Software.
  //   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
  //   NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  //   NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
  //   OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
  //   CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
  const CONTRAST_PATTERNS = (() => {
    const MAXG = 160;
    const PRON = '(?:it|they|this|that)';
    const BE = '(?:is|are|was|were)';
    const BE_NEG = "(?:is\\s+not|are\\s+not|was\\s+not|were\\s+not|isn't|aren't|wasn't|weren't|ain't)";
    const Q = '["“”\']?';
    const START = '(?:(?<=^)|(?<=[.?!]\\s))';
    const REPORTER = '(?![^.?!]{0,80}\\b(?:knew|know|thought|think|said|says|told|heard|learned)\\b[^.?!]{0,40}?\\bthat\\b)';
    return [
      `\\b(?:(?:${BE_NEG})|not(?!\\s+(?:that|only)\\b))\\s+(?:(?!\\bbut\\b|[.?!]).){1,100}?[,;:]\\s*but\\s+` +
        '(?!when\\b|while\\b|which\\b|who\\b|whom\\b|whose\\b|where\\b|if\\b|that\\b|as\\b|because\\b|although\\b|though\\b|till\\b|until\\b|unless\\b|' +
        'here\\b|there\\b|then\\b|my\\b|we\\b|I\\b|you\\b|it\\s+seems\\b|it\\s+appears\\b|it\\s+felt\\b|it\\s+looks?\\b|anything\\b)',
      `\\b(?:\\w+n't|not)\\s+(?:just|only|merely)?\\s+(?:(?![.?!]).){1,${MAXG}}?(?:-|\\s-\\s|[—–])\\s*${PRON}\\s+(?:(?:'re|are|'s|is|were|was)\\b|(?!'re|are|'s|is|were|was)[*_~]*[a-z]\\w*)`,
      `${START}\\s*${Q}(?:(?:${PRON}\\s+${BE}\\s+not)|(?:${PRON}\\s+${BE}n't)|(?:it's|they're|that's)\\s+not)\\b[^.?!]{0,${MAXG}}[.;:?!]\\s*${Q}${PRON}(?:\\s+${BE}|'s|'re)\\b(?!\\s+not\\b)`,
      `${START}\\s*${REPORTER}(?!\\s*not\\s+without\\b)(?![^.?!]{0,50}\\bnot\\s+put\\b)[^.?!]{0,${MAXG}}?\\b(?:${BE_NEG})\\b[^.?!]{0,${MAXG}}[.;:?!]\\s*${Q}${PRON}\\b(?:'re|'s|\\s+(?:are|were|is|was))\\b(?!\\s+not\\b)`,
      `${START}\\s*[^.?!]{0,${MAXG}}\\bno\\s+longer\\b[^.;:?!]{0,${MAXG}}[.;:?!]\\s*(?:it|they|this|that)\\s+(?:is|are|was|were)\\b(?!\\s+not\\b)`,
      `${START}\\s*${Q}${PRON}\\b(?:'s|'re|\\s+(?:is|are|was|were))?\\s+not\\s+just\\b[^.?!]{0,${MAXG}}[.?!]\\s*${Q}${PRON}\\b(?:'s|'re|\\s+(?:is|are|was|were))\\b(?!\\s+not\\b)`,
      `${START}[^.?!]*?\\b(?:do|does|did)n't\\b\\s+(?:(?:\\w+\\s+){0,2})([a-z]{3,})\\b[^.?!]*[.?!]\\s*${PRON}\\s+\\1(?:ed|es|s|ing)?\\b`,
      `${START}\\s*${Q}(?!he\\b|she\\b|i\\b|you\\b|we\\b)${REPORTER}[^.?!]{0,${MAXG}}?\\b${BE_NEG}\\b[^.?!]{0,${MAXG}}[.;:?!]\\s*${Q}it(?:'s|\\s+(?:is|are|was|were))\\b`,
      `${START}[^.?!]{0,80}?\\b(?:(?:it|they)\\s+(?:is|are)|(?:it's|they're))\\s+not\\s+just\\b[^.?!]{0,${MAXG}}[.?!]\\s*(?:(?:it|they)\\s+(?:is|are)|(?:it's|they're))\\b`,
      `${Q}${PRON}(?:'re|'s|\\s+(?:are|is|was|were))\\s+not\\s+just\\b[^"“”']{0,${MAXG}}${Q}\\s*(?:[^.?!]{0,80}\\b(?:said|asked|whispered|muttered|replied|added|shouted|cried)\\b[^.?!]{0,80}[.?!]\\s*)?${Q}${PRON}(?:'re|'s|\\s+(?:are|is|was|were))\\s+[*_~]?[a-z]\\w*`,
      // Project additions: comma-spliced "it's not X, it's Y" and repeated-verb
      // pivots such as "We aren't building X. We're building Y."
      "\\b(?:it|this|that)(?:'s|\\s+is)\\s+not\\s+(?:just\\s+|only\\s+|about\\s+)?[^.?!,;\\n]{1,80}[,;]\\s*(?:it|this|that)(?:'s|\\s+is)\\b",
      "\\b(we|you|they|i)\\s+(?:aren't|are\\s+not|weren't|were\\s+not|don't|do\\s+not|didn't|did\\s+not|'re\\s+not|'m\\s+not|am\\s+not)\\s+([a-z]{3,})\\b[^.?!\\n]{0,120}[.?!;—–]\\s*\\1(?:'re|'m|\\s+(?:are|am|were|do|did))?\\s+\\2\\b"
    // 'm' lets ^ match after line breaks (LinkedIn posts put each sentence on its own
    // line); clause bodies stay within one line so a pivot never absorbs a list above it.
    ].map((source) => new RegExp(source.replace(/\[\^\.\?!\]/g, '[^.?!\\n]'), 'gim'));
  })();

  function dropNested(spans) {
    return spans.sort((a, b) => a.start - b.start || b.end - a.end)
      .filter((span, index, all) => !all.slice(0, index).some((prior) => prior.start <= span.start && prior.end >= span.end));
  }

  function termSpans(parsed, compiled) {
    const text = normalizeApostrophes(parsed.masked);
    const spans = [];
    for (const { key, re } of compiled) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(text))) {
        const start = match.index + match[1].length;
        const end = start + match[2].length;
        if (!parsed.excluded.some((span) => start < span.end && end > span.start)) spans.push({ start, end, key });
      }
    }
    return dropNested(spans);
  }

  function regexSpans(text, re, excluded) {
    re.lastIndex = 0;
    return Array.from(text.matchAll(re), (match) => ({ start: match.index, end: match.index + match[0].length }))
      .filter((span) => span.end > span.start && !excluded.some((other) => span.start < other.end && span.end > other.start));
  }

  function mergeOverlapping(spans) {
    const merged = [];
    for (const span of spans.slice().sort((a, b) => a.start - b.start)) {
      const last = merged[merged.length - 1];
      if (last && span.start < last.end) last.end = Math.max(last.end, span.end);
      else merged.push({ start: span.start, end: span.end });
    }
    return merged;
  }

  // Reads utm_source/referrer from a link, following one redirect wrapper
  // such as l.facebook.com/l.php?u= or youtube.com/redirect?q=. Plain string
  // parsing keeps this independent of the URL global.
  function aiReferralSource(href) {
    let value = String(href || '');
    for (let depth = 0; depth < 2; depth += 1) {
      const query = value.replace(/#.*$/, '');
      const param = (name) => {
        const match = query.match(new RegExp('[?&]' + name + '=([^&]*)', 'i'));
        if (!match) return '';
        try { return decodeURIComponent(match[1].replace(/\+/g, ' ')); } catch (error) { return match[1]; }
      };
      const source = param('utm_source').toLowerCase();
      if (AI_UTM_SOURCES.has(source)) return 'utm_source=' + source;
      if (param('referrer').toLowerCase() === 'grok.com') return 'referrer=grok.com';
      const inner = ['u', 'url', 'q', 'target', 'dest', 'redirect'].map(param).find((candidate) => /^https?:\/\//i.test(candidate));
      if (!inner) break;
      value = inner;
    }
    return null;
  }

  function scoreFamilies(families, coverage, assessed, profile) {
    const counts = { definitive: 0, moderate: 0, supporting: 0 };
    for (const family of families) counts[family.tier] += 1;
    const core = counts.definitive * TIER_POINTS.definitive + counts.moderate * TIER_POINTS.moderate;
    const supportingPoints = counts.supporting * TIER_POINTS.supporting;
    const points = core + (core > 0 || profile.supportingAlone ? supportingPoints : 0);
    let stamp = 'none';
    if (assessed) {
      if (coverage.level === 'short') stamp = counts.definitive ? 'high' : profile.shortModerate && points >= STAMP_POINTS.moderate ? 'moderate' : 'none';
      else if (points >= STAMP_POINTS.high) {
        // Correlated families are not independent confirmation: without a
        // definitive artifact, high needs both word-choice and structure.
        const kinds = new Set(families.map((family) => family.evidence));
        stamp = counts.definitive || (kinds.has('word-choice') && kinds.has('structure')) ? 'high' : 'moderate';
      } else if (points >= STAMP_POINTS.moderate) stamp = 'moderate';
      // Rhythm and repetition rules each matched 2-5% of pre-2022 human
      // answers (docs/accuracy-validation.md), so structure-only evidence
      // needs two families before it can stamp.
      const decisive = families.filter((family) => family.tier !== 'supporting');
      if (profile.pairStructure && stamp !== 'none' && !decisive.some((family) => family.evidence !== 'structure') && decisive.length < 2) stamp = 'none';
      // "Possible AI": some evidence matched, but less than a moderate stamp needs.
      if (stamp === 'none' && profile.lowStamp === 'any' && families.length) stamp = 'low';
      if (stamp === 'none' && profile.lowStamp === 'evidence' && (decisive.length || supportingPoints >= STAMP_POINTS.moderate)) stamp = 'low';
    }
    return { counts, points, stamp };
  }

  function analyzeStyleCues(rawText, extracted, context, sensitivity) {
    const profile = profileFor(sensitivity);
    const parsed = extracted.parsed || parseText(rawText);
    const raw = parsed.masked;
    const norm = normalizeApostrophes(raw);
    const options = context || {};
    const coverage = heuristicCoverage(extracted.metrics);
    const families = [];
    const assessed = !['unsupported', 'uncertain'].includes(coverage.level);
    const prose = parsed.sentences.filter((sentence) => !sentence.isList);
    const proseTokens = prose.map(tokensWithOffsets);
    const proseWordCount = prose.reduce((sum, sentence) => sum + sentence.length, 0);
    const inList = (span) => parsed.sentences.some((sentence) => sentence.isList && span.start < sentence.end && span.end > sentence.start);
    function add(id, name, detail, spans, tierOverride) {
      const info = FAMILY_INFO[id];
      const tier = tierOverride || info.tier;
      families.push({ id, name, detail, spans: spans.slice(0, 8), tier, evidence: info.evidence, points: TIER_POINTS[tier] });
    }

    if (assessed) {
      // Definitive: wording or markup that an assistant emits and people
      // rarely type. Quoted and code spans are already masked.
      const references = [...modelReferenceSpans(parsed), ...regexSpans(norm, KNOWLEDGE_DISCLAIMER, parsed.excluded)];
      if (references.length) {
        add('self-disclosure', 'Model reference or capability disclaimer',
          'Model-reference, knowledge-cutoff, or capability wording outside quotations or code.', mergeOverlapping(references));
      }

      const leftovers = mergeOverlapping([
        ...regexSpans(norm, ASSISTANT_OPENER, parsed.excluded), ...regexSpans(norm, DELIVERY_LINE, parsed.excluded),
        ...regexSpans(norm, ASSISTANT_SIGNOFF, parsed.excluded), ...regexSpans(raw, PLACEHOLDER, parsed.excluded)
      ]);
      if (leftovers.length) {
        add('assistant-leftovers', 'Unedited assistant output',
          leftovers.length + ' assistant preamble, sign-off, or unfilled placeholder' + (leftovers.length === 1 ? '' : 's') +
            '. Someone may have pasted a chatbot reply without editing it.', leftovers);
      }

      // Recognizable serialization remnants, not ordinary Markdown, Unicode,
      // or a model name. Quoted/code examples are masked by the shared parser.
      const artifacts = [
        ...Array.from(raw.matchAll(/<\|im_start\|>assistant\b|<\|start_header_id\|>assistant<\|end_header_id\|>|<\|start\|>assistant<\|message\|>|\uE200cite\uE202turn\d+(?:search|view|news|file)\d+[^\uE201\n]{0,180}\uE201/g), (match) => ({ start: match.index, end: match.index + match[0].length })),
        ...regexSpans(raw, EXTRA_MARKUP, parsed.excluded)
      ];
      const markdown = [];
      if (!options.rendersMarkdown) {
        const bold = regexSpans(raw, MARKDOWN_BOLD, parsed.excluded);
        const headings = regexSpans(raw, MARKDOWN_HEADING, parsed.excluded);
        const links = regexSpans(raw, MARKDOWN_LINK, parsed.excluded);
        const boldLine = bold.some((span) => (span.start === 0 || raw[span.start - 1] === '\n') &&
          (span.end === raw.length || raw[span.end] === '\n'));
        if (bold.length >= 2 || boldLine || headings.length || links.length) markdown.push(...headings, ...links, ...bold);
      }
      if (artifacts.length || markdown.length) {
        add('markup-artifacts', 'Assistant markup artifacts',
          (artifacts.length ? artifacts.length + ' assistant-role or citation marker' + (artifacts.length === 1 ? '' : 's') + '. ' : '') +
            (markdown.length ? 'Literal Markdown that this site does not render. ' : '') +
            'Text copied from a chatbot keeps these; a person may also reproduce them.',
          mergeOverlapping([...artifacts, ...markdown]));
      }

      const referralSpans = regexSpans(norm, AI_REFERRAL_TEXT, parsed.excluded);
      const referralLinks = Array.from(new Set((options.links || []).map(aiReferralSource).filter(Boolean)));
      if (referralSpans.length || referralLinks.length) {
        add('ai-referral-link', 'Link copied from an AI assistant',
          (referralLinks.length ? 'Linked URL carries ' + referralLinks.join(', ') + '. ' : '') +
            'AI assistants add these tracking parameters to links they cite. This shows an AI tool was used, not that it wrote the post.',
          referralSpans);
      }

      // Moderate, word choice.
      const framingSpans = termSpans(parsed, COMPILED.framing);
      const framingKeys = (spans) => new Set(spans.map((span) => FRAMING_TERMS[span.key]));
      const distinct = framingKeys(framingSpans);
      const weak = Array.from(distinct).filter((phrase) => WEAK_FRAMING_SET.has(phrase));
      const strong = distinct.size - weak.length;
      const effective = strong + (weak.length >= profile.weakFramingMin ? weak.length : 0);
      const needed = profile.scaleFraming ? Math.max(2, Math.ceil(proseWordCount / 120)) : 2;
      const buzzSpans = termSpans(parsed, COMPILED.buzz);
      const distinctBuzz = new Set(buzzSpans.map((span) => span.key));
      if (effective >= needed || (strong >= 1 && distinctBuzz.size >= 2)) {
        add('formulaic-framing', 'Stock framing phrases',
          strong + ' distinct framing phrase' + (strong === 1 ? '' : 's') + ' (' + needed + ' needed at this length); ' +
            weak.length + ' common phrase' + (weak.length === 1 ? '' : 's') + (profile.weakFramingMin > 1 ? ' (counted only in threes); ' : '; ') + distinctBuzz.size + ' promotional terms.',
          [...framingSpans.filter((span) => effective >= needed || !WEAK_FRAMING_SET.has(FRAMING_TERMS[span.key])), ...buzzSpans]
            .sort((a, b) => a.start - b.start));
      }

      // Repeated "not X, but Y" pivots. A lone contrast remains unremarkable.
      // In-sentence "not X, but Y" is a common human hedge ("I'm not a
      // physicist, but …"), so it counts half unless it is the assistant's
      // "not just/merely/simply X, but Y"; sentence-level pivots count once.
      const notBut = regexSpans(norm, CONTRAST_PATTERNS[0], parsed.excluded).filter((span) => !inList(span));
      const balanced = notBut.filter((span) => /\bnot\s+(?:just|merely|simply)\b/i.test(norm.slice(span.start, span.end)));
      const pivots = mergeOverlapping(CONTRAST_PATTERNS.slice(1).flatMap((re) => regexSpans(norm, re, parsed.excluded)))
        .filter((span) => !inList(span) && !notBut.some((other) => span.start < other.end && span.end > other.start));
      const contrastWeight = pivots.length + balanced.length + (notBut.length - balanced.length) * profile.notButWeight;
      if ((contrastWeight >= 2 && proseWordCount >= 30) || contrastWeight >= 3) {
        const contrasts = mergeOverlapping([...pivots, ...notBut]);
        add('contrast-framing', 'Repeated contrast pivots',
          contrasts.length + ' "not X, but Y" or "it isn\'t X. It\'s Y" constructions. People use them too; repetition is the signal.', contrasts);
      }

      const vocabulary = termSpans(parsed, COMPILED.vocabulary);
      const distinctVocabulary = new Set(vocabulary.map((span) => span.key));
      if (distinctVocabulary.size >= profile.vocabularyMin &&
        distinctVocabulary.size * 100 / Math.max(1, extracted.metrics.wordCount) >= profile.vocabularyDensity) {
        add('ai-vocabulary', 'Words LLMs overuse',
          distinctVocabulary.size + ' distinct words that chatbots use far more than people (for example delve, tapestry, pivotal). One or two can be coincidence.',
          vocabulary);
      }

      const register = termSpans(parsed, COMPILED.register);
      const distinctRegister = new Set(register.map((span) => span.key));
      if (distinctRegister.size >= profile.registerMin) {
        add('chatbot-register', 'Chatbot social-post register',
          distinctRegister.size + ' stock phrases chat models use when writing posts ("fellow redditors", "thanks in advance", "would be greatly appreciated"). People use some of these too.',
          register);
      }

      const phrasing = termSpans(parsed, COMPILED.phrasing);
      if (phrasing.length >= profile.phrasingMin) {
        add('llm-phrasing', 'Copula avoidance and trailing -ing clauses',
          phrasing.length + ' constructions such as "serves as", "plays a crucial role", or ", highlighting …".', phrasing);
      }

      // Moderate, structure.
      const openingGroups = new Map();
      for (const tokens of proseTokens) {
        if (tokens.length < 2) continue;
        const first = tokens.slice(0, 2);
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
      // Two shared openings are ordinary ("For example", "I think"); require
      // three, or two that share four or more words.
      const openingSpans = repeatedOpenings.filter((spans) => {
        const tokens = tokenize(raw.slice(spans[0].start, spans[0].end));
        if (tokens.slice(0, 2).every((word) => STOPWORDS.has(word))) return spans.length >= 3 && tokens.length >= 3;
        return !profile.strictOpenings || spans.length >= 3 || tokens.length >= 4;
      }).flat();
      if (prose.length >= 3 && openingSpans.length) {
        add('repeated-openings', 'Repeated sentence openings',
          openingSpans.length + ' of ' + prose.length + ' prose sentences reuse a multiword opening.', openingSpans);
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
            if (openingSpans.some((span) => start < span.end && end > span.start)) continue;
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

      // Supporting: formatting people also use. Counts only alongside another family.
      const listSpans = [];
      let lineOffset = 0;
      for (const line of raw.split('\n')) {
        if (LIST_MARKER.test(line) && line.trim()) {
          listSpans.push({ start: lineOffset + line.length - line.trimStart().length, end: lineOffset + line.length });
        }
        lineOffset += line.length + 1;
      }
      // Clock times (10:30), ratios and numeric ranges (2015–2019) are not
      // presentation punctuation.
      const punctuation = Array.from(raw.matchAll(/(?<!\d):(?!\/\/|\d)|(?<!\d)[—–](?!\d)/g), (match) => ({ start: match.index, end: match.index + 1 }));
      const colons = punctuation.filter((span) => raw[span.start] === ':').length;
      const dashes = punctuation.length - colons;
      if (listSpans.length >= 3 || (extracted.metrics.wordCount >= 30 &&
        ((colons >= 2 && dashes >= 1) || dashes >= 3) &&
        punctuation.length * 100 / extracted.metrics.wordCount >= 4)) {
        add('structured-presentation', 'List and punctuation structure',
          listSpans.length + ' list items; ' + colons + ' colons; ' + dashes + ' dashes.',
          listSpans.length >= 3 ? listSpans : punctuation);
      }

      // Creator-post template (LinkedIn "broetry"): a short hook line, mostly
      // one-line paragraphs, a closing engagement prompt, a hashtag block,
      // three or more bullets, or a P.S. Human growth writers use it too, so it
      // is formatting evidence except in the sensitive profile.
      const allLines = raw.split('\n').filter((line) => line.trim());
      const blockLines = allLines.map((line) => line.trim());
      const proseLines = allLines.filter((line) => !LIST_MARKER.test(line)).map((line) => line.trim());
      const templateFeatures = [];
      if (blockLines.length >= 4 && !LIST_MARKER.test(allLines[0]) && tokenize(blockLines[0]).length <= 12 &&
        /^[^\n]*\n[ \t]*\n/.test(raw.trimStart())) templateFeatures.push('hook line');
      if (proseLines.length >= 4 && proseLines.filter((line) => tokenize(line).length <= 15 && !/[.!?]\s+\S/.test(line)).length / proseLines.length >= 0.7) {
        templateFeatures.push('one-line paragraphs');
      }
      if (listSpans.length >= 3) templateFeatures.push('bullets');
      const closers = [];
      if (blockLines.slice(-2).some((line) => ENGAGEMENT_PROMPT.test(normalizeApostrophes(line)))) closers.push('engagement prompt');
      if (blockLines.length && (blockLines[blockLines.length - 1].match(/(?:^|\s)#[\p{L}\p{N}_]+/gu) || []).length >= 3) closers.push('hashtag block');
      if (/^P\.?S\.?(?:\s|:)/m.test(raw)) closers.push('P.S.');
      // A template is a hook/body/closer shape: at least three features, one of them a closer.
      if (closers.length && templateFeatures.length + closers.length >= 3) {
        add('engagement-template', 'Creator-post template',
          'Template features: ' + [...templateFeatures, ...closers].join(', ') + '. Common in AI-written LinkedIn posts and in human growth writing alike.',
          [], profile.templateTier);
      }

      const typographySpans = [];
      lineOffset = 0;
      const lines = raw.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        const start = lineOffset + line.length - line.trimStart().length;
        lineOffset += line.length + 1;
        if (!trimmed || index === lines.length - 1 || /[.!?,;:]$/.test(trimmed)) return;
        const words = trimmed.split(/\s+/).filter((word) => /\p{L}/u.test(word));
        const major = words.filter((word) => word.replace(/[^\p{L}]/gu, '').length >= 4);
        if (words.length >= 3 && words.length <= 10 && major.length >= 2 && !LIST_MARKER.test(line) &&
          major.every((word) => /^[^\p{L}]*\p{Lu}/u.test(word)) && trimmed !== trimmed.toUpperCase()) {
          typographySpans.push({ start, end: start + trimmed.length });
        }
      });
      // Curly quotes are not counted: iOS and macOS insert them automatically.
      if (typographySpans.length) {
        add('typography', 'Title Case headings',
          typographySpans.length + ' Title Case heading line' + (typographySpans.length === 1 ? '' : 's') + '. Editors and some writers use these too.',
          typographySpans);
      }
    }
    const score = scoreFamilies(families, coverage, assessed, profile);
    const level = !assessed ? 'unassessed' : score.stamp === 'high' ? 'cue-high' : score.stamp === 'moderate' ? 'cue-moderate' :
      score.stamp === 'low' ? 'cue-low' : families.length ? 'cue-weak' : 'cue-none';
    return {
      level, text: assessed ? families.length + ' matched' : 'Not assessed',
      families, totalFamilies: Object.keys(FAMILY_INFO).length, coverage, assessed,
      points: score.points, stamp: score.stamp, tierCounts: score.counts, sensitivity: profile.name
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
    const englishWords = tokens.filter((token) => ENGLISH_EVIDENCE.has(token) && !sharedWords.has(token));
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
    const hedgeHits = modelReferenceSpans(parsed).length;
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
    const listMarkerCount = lines.filter((line) => LIST_MARKER.test(line)).length;
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
    const cueAssessment = analyzeStyleCues(rawText, extracted, safeContext, safeSettings.cueSensitivity);
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

function aiHeuristicReadContent(node, options = {}) {
  const excluded = { quotes: 0, code: 0 };
  if (!node) return { text: '', excluded, links: [] };
  const parts = [];
  // Link targets of author-owned text only (quotes/code/UI are skipped
  // below). The detector reads AI-assistant tracking parameters from them.
  const links = [];
  const blocks = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  const preserveLines = /pre|break-spaces/.test(window.getComputedStyle(node).whiteSpace);
  function visit(current, preserve, inList = false) {
    if (current.nodeType === 3) {
      parts.push(preserve && !inList ? current.nodeValue : current.nodeValue.replace(/\s+/g, ' '));
      return;
    }
    if (current.nodeType !== 1) return;
    if (current.matches('[data-ai-heuristic-ui], script, style, template, noscript, button, [role="button"], input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
    if (current.matches('blockquote, q, [data-testid="quoteTweet"], .update-components-mini-update-v2') ||
      (current !== node && options.quoteSelector && current.matches(options.quoteSelector))) {
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
    if (current.tagName === 'A' && links.length < 20) {
      const href = current.getAttribute('href');
      if (href && !links.includes(href)) links.push(href);
    }
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
  return { text, excluded, links };
}

function aiHeuristicTextContent(node) {
  return aiHeuristicReadContent(node).text;
}

// Keep controls outside links/buttons owned by the site. Adapters choose a
// header belonging to this post; unknown layouts fall back above its text.
function aiHeuristicPlaceHeaderBadge(element, badge, header, body) {
  let parent, before;
  if (header && element.contains(header)) {
    const interactive = header.closest('a, button, [role="link"], [role="button"]');
    if (interactive && element.contains(interactive) && interactive !== element) {
      parent = interactive.parentElement;
      before = interactive.nextSibling;
    } else if (!interactive) {
      parent = header;
      before = null;
    }
  }
  const inHeader = Boolean(parent);
  if (!parent) {
    parent = body && body !== element && element.contains(body) ? body.parentElement : element;
    before = parent === element && (!body || body === element) ? element.firstChild : body;
  }
  // Mutation rescans may discover a header after the text. Reposition only
  // when necessary so our own DOM writes do not perpetually trigger rescans.
  if (badge.parentElement === parent && (before === badge || badge.nextSibling === before)) return;
  const singleGridItem = inHeader && parent !== header && Array.from(parent.children).filter(node => node !== badge).length === 1 &&
    window.getComputedStyle(parent).display === 'grid';
  parent.insertBefore(badge, before);
  badge.dataset.placement = inHeader ? 'header' : 'before-text';
  // Current LinkedIn author links occupy a one-item grid. Its second column
  // puts the stamp beside the name without rewriting the site's layout.
  badge.style.gridArea = singleGridItem ? '1 / 2' : '';
}

function startAIHeuristic(platformAdapter, modelBundle, options) {
  'use strict';
  options = options || {};

  const adapter = platformAdapter;
  const instance = options.instance || 'aih-' + Math.random().toString(36).slice(2);
  const owned = '[data-ai-style-instance="' + instance + '"]';
  let notice = options.notice || '';
  let legacyBlocked = false;
  let running = false;
  let rootObserver = null;
  let routeTimer = null;
  let bodyReference = null;
  let lastUrl = location.href;
  let navigationPending = false;
  const reportedFailures = new Set();
  const engine = createDetectorEngine({ platform: adapter.id, modelBundle });
  const storageKey = `ai-heuristic:${adapter.id}:settings:v2`;
  const defaults = {
    enabled: options.enabledByDefault !== false,
    sensitivity: 'balanced',
    // Stamp sensitivity (0.10): strict | balanced | sensitive. Separate from
    // the legacy diagnostic-model `sensitivity`, which older settings may hold.
    cueSensitivity: 'balanced',
    analyzeComments: true,
    hideInsufficient: false,
    hideLow: false
  };
  let settings = loadSettings();
  const settingsManager = getSettingsManager();
  const managerStorageKey = storageKey + '@' + location.origin;
  let settingsPending = Boolean(settingsManager);
  let settingsWrite = Promise.resolve();
  let storageNotice = options.settingsStorage === 'manager' && !settingsManager
    ? 'This script manager cannot save preferences outside page storage. They may reset after reloading.' : '';
  let records = new WeakMap();
  let activePopover = null;
  let popoverCloseTimer = null;
  let observer = null;
  let intersectionObserver = null;
  let queueTimer = null;
  let stopped = false;
  let started = false;
  const tracked = new Set();
  let visible = new WeakSet();
  const dirty = new Set();
  const pending = new Set();
  const analysisCache = new Map();
  const candidateSelector = adapter.postSelector + ', ' + adapter.commentSelector;

  const STYLE = `
    button.ai-heuristic-badge[data-ai-heuristic-ui] {
      --aih-accent: #984000;
      --aih-stamp-bg: #fff4e8;
      align-items: center;
      justify-content: center;
      background: var(--aih-stamp-bg);
      border: 1px solid currentColor;
      border-radius: 2px;
      box-sizing: border-box;
      color: var(--aih-accent);
      cursor: pointer;
      display: inline-flex;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: var(--aih-stamp-font-size, calc(var(--aih-post-font-size, 16px) * .625));
      font-weight: 800;
      line-height: 1;
      height: var(--aih-post-line-height, 24px);
      min-height: 0;
      max-height: none;
      width: max-content;
      max-width: 100%;
      min-width: 0;
      margin: 2px 0;
      padding: 0 6px;
      flex: 0 0 auto;
      align-self: flex-start;
      appearance: none;
      text-indent: 0;
      text-transform: uppercase;
      letter-spacing: .055em;
      text-align: center;
      vertical-align: baseline;
      white-space: nowrap;
    }
    button.ai-heuristic-badge[data-ai-heuristic-ui][data-cue-tone="high"] {
      --aih-accent: #b01e29;
      --aih-stamp-bg: #fff0f1;
      border-style: double;
      border-width: 3px;
      padding: 0 4px;
    }
    button.ai-heuristic-badge[data-ai-heuristic-ui][data-cue-tone="low"] {
      --aih-accent: #4b5563;
      --aih-stamp-bg: #f5f6f8;
      border-style: dashed;
      font-weight: 700;
    }
    button.ai-heuristic-badge[data-ai-heuristic-ui][data-placement="header"] {
      margin-inline-start: 6px;
      max-width: calc(100% - 6px);
      vertical-align: middle;
    }
    button.ai-heuristic-badge[data-ai-heuristic-ui]:hover,
    button.ai-heuristic-badge[data-ai-heuristic-ui][aria-expanded="true"] {
      background: var(--aih-accent);
      color: var(--aih-stamp-bg);
      border-color: var(--aih-accent);
    }
    button.ai-heuristic-badge[data-ai-heuristic-ui]:focus-visible {
      outline: 2px solid var(--aih-accent);
      outline-offset: 3px;
    }
    button.ai-heuristic-badge[data-ai-heuristic-ui] .ai-heuristic-badge__text {
      color: inherit;
      font: inherit;
      line-height: 1;
      letter-spacing: inherit;
      text-transform: inherit;
      white-space: nowrap;
      margin: 0;
      padding: 0;
    }
    .ai-heuristic-popover[data-cue-tone="moderate"] { --aih-accent: #984000; }
    .ai-heuristic-popover[data-cue-tone="high"] { --aih-accent: #b01e29; }
    .ai-heuristic-popover[data-cue-tone="low"] { --aih-accent: #4b5563; }
    .ai-heuristic-popover[data-entry="stamp"] {
      animation: aih-stamp-grow 180ms cubic-bezier(.16, 1, .3, 1) both;
    }
    @keyframes aih-stamp-grow {
      from { opacity: 0; transform: scale(.86); }
      to { opacity: 1; transform: scale(1); }
    }
    .ai-heuristic-popover .ai-heuristic-popover__result {
      background: var(--aih-panel);
      border-radius: 8px;
      color: var(--aih-text);
      font-size: 14px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      margin: 0 0 12px;
      padding: 10px 12px;
    }
    .ai-heuristic-popover .ai-heuristic-cues { list-style: none; padding: 0; }
    .ai-heuristic-popover .ai-heuristic-cues > li { margin: 0; padding: 10px 0; }
    .ai-heuristic-popover .ai-heuristic-cues > li + li { border-top: 1px solid var(--aih-border); }
    .ai-heuristic-popover .ai-heuristic-cue-detail { color: var(--aih-muted); margin: 4px 0 6px; }
    .ai-heuristic-popover .ai-heuristic-cue-tier { display: block; color: var(--aih-muted); font-size: .85em; margin-top: 2px; }
    .ai-heuristic-popover .ai-heuristic-cue-example { background: var(--aih-panel); border-radius: 6px; color: var(--aih-text); overflow-wrap: anywhere; white-space: pre-wrap; margin: 6px 0; padding: 8px 10px; font-size: 12px; }
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
    .ai-heuristic-launcher:hover { background: #312e81; }
    .ai-heuristic-launcher:disabled { cursor: wait; opacity: .75; }
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
    .ai-heuristic-popover, .ai-heuristic-popover * { box-sizing: border-box; }
    .ai-heuristic-popover p, .ai-heuristic-popover li, .ai-heuristic-popover label {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      letter-spacing: normal;
      text-transform: none;
    }
    .ai-heuristic-popover__header {
      align-items: flex-start;
      border-bottom: 1px solid var(--aih-border);
      display: flex;
      gap: 12px;
      justify-content: space-between;
      padding: 15px 16px 13px;
      position: sticky;
      top: 0;
      background: var(--aih-bg);
      z-index: 1;
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
      flex: 0 0 30px;
    }
    .ai-heuristic-popover__close:hover { background: var(--aih-panel); color: var(--aih-text); }
    .ai-heuristic-popover__close:focus-visible,
    .ai-heuristic-popover select:focus-visible,
    .ai-heuristic-popover input:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--aih-accent) 32%, transparent);
      outline-offset: 2px;
    }
    .ai-heuristic-popover__body { padding: 14px 16px 16px; }
    .ai-heuristic-popover .ai-heuristic-popover__summary { color: var(--aih-muted); margin: 0 0 12px; }
    .ai-heuristic-popover .ai-heuristic-popover__notice {
      background: color-mix(in srgb, var(--aih-accent) 7%, var(--aih-panel));
      border-radius: 8px;
      color: var(--aih-text);
      margin: 10px 0 13px;
      padding: 9px 10px;
    }
    .ai-heuristic-popover__section { border-top: 1px solid var(--aih-border); margin-top: 13px; padding-top: 12px; }
    .ai-heuristic-popover__section h3 { color: var(--aih-text); font-size: 13px; line-height: 1.35; margin: 0 0 7px; }
    .ai-heuristic-popover__section ul { margin: 0; padding-left: 19px; }
    .ai-heuristic-popover__section li { margin: 3px 0; }
    .ai-heuristic-popover__empty { color: var(--aih-muted); margin: 0; }
    .ai-heuristic-popover details { margin-top: 12px; }
    .ai-heuristic-popover summary { color: var(--aih-text); cursor: pointer; font-weight: 650; padding: 4px 0; }
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
      gap: 0;
    }
    .ai-heuristic-popover__settings label {
      align-items: center;
      color: var(--aih-text);
      display: flex;
      gap: 12px;
      justify-content: space-between;
      min-width: 0;
      padding: 8px 0;
      overflow-wrap: anywhere;
    }
    .ai-heuristic-popover__settings label + label { border-top: 1px solid var(--aih-border); }
    .ai-heuristic-popover__settings input[type="checkbox"] {
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      margin: 0;
    }
    .ai-heuristic-popover__settings select {
      background: var(--aih-bg);
      border: 1px solid var(--aih-border);
      border-radius: 8px;
      color: var(--aih-text);
      font: inherit;
      padding: 5px 7px;
      max-width: 62%;
      min-width: 0;
    }
    .ai-heuristic-popover .ai-heuristic-popover__footer {
      color: var(--aih-muted);
      font-size: 10px;
      margin: 13px 0 0;
    }
    @media (max-width: 420px) {
      .ai-heuristic-launcher { bottom: max(10px, env(safe-area-inset-bottom)); right: max(10px, env(safe-area-inset-right)); }
      .ai-heuristic-popover__header { padding: 12px 14px; }
      .ai-heuristic-popover__body { padding: 12px 14px 14px; }
    }
    @media (prefers-color-scheme: dark) {
      button.ai-heuristic-badge[data-ai-heuristic-ui] {
        --aih-accent: #ffb36b;
        --aih-stamp-bg: #302217;
      }
      button.ai-heuristic-badge[data-ai-heuristic-ui][data-cue-tone="high"] {
        --aih-accent: #ff929a;
        --aih-stamp-bg: #321d22;
      }
      button.ai-heuristic-badge[data-ai-heuristic-ui][data-cue-tone="low"] {
        --aih-accent: #c3cad6;
        --aih-stamp-bg: #232833;
      }
      .ai-heuristic-popover[data-cue-tone="moderate"] { --aih-accent: #ffb36b; }
      .ai-heuristic-popover[data-cue-tone="high"] { --aih-accent: #ff929a; }
      .ai-heuristic-popover[data-cue-tone="low"] { --aih-accent: #c3cad6; }
      .ai-heuristic-popover {
        --aih-bg: #151a24;
        --aih-panel: #202735;
        --aih-text: #f2f5fa;
        --aih-muted: #aeb8ca;
        --aih-border: #343e50;
        box-shadow: 0 22px 65px rgba(0, 0, 0, .55);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ai-heuristic-popover[data-entry="stamp"] { animation: none; }
    }
    @media (forced-colors: active) {
      button.ai-heuristic-badge[data-ai-heuristic-ui], .ai-heuristic-popover { border-color: ButtonText; forced-color-adjust: auto; }
      button.ai-heuristic-badge[data-ai-heuristic-ui]:hover { background: Highlight; color: HighlightText; }
    }
  `;

  function normalizeSettings(value) {
    const stored = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const result = { ...defaults, ...stored };
    for (const key of ['enabled', 'analyzeComments', 'hideInsufficient', 'hideLow']) {
      if (typeof result[key] !== 'boolean') result[key] = defaults[key];
    }
    if (!['balanced', 'conservative', 'aggressive'].includes(result.sensitivity)) result.sensitivity = defaults.sensitivity;
    if (!['strict', 'balanced', 'sensitive'].includes(result.cueSensitivity)) result.cueSensitivity = defaults.cueSensitivity;
    return result;
  }

  function loadSettings() {
    try { return normalizeSettings(JSON.parse(localStorage.getItem(storageKey) || '{}')); }
    catch (_) { return { ...defaults }; }
  }

  function getSettingsManager() {
    if (options.settingsStorage !== 'manager') return null;
    try {
      if (typeof GM !== 'undefined' && typeof GM.getValue === 'function' && typeof GM.setValue === 'function') return GM;
    } catch (_) { /* Preserve the page-storage fallback in other managers. */ }
    return null;
  }

  function persistManagedSettings(value) {
    if (!settingsManager) return;
    // Keep rapid setting changes ordered, including the initial migration.
    const saved = { ...value };
    settingsWrite = settingsWrite.then(() => settingsManager.setValue(managerStorageKey, saved)).then(() => {
      storageNotice = '';
    }).catch(() => {
      storageNotice = 'Settings could not be saved. Changes may last only for this tab.';
    });
  }

  async function loadManagedSettings() {
    if (!settingsManager) return;
    try {
      const saved = await settingsManager.getValue(managerStorageKey, null);
      if (stopped) return;
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) settings = normalizeSettings(saved);
      else persistManagedSettings(settings); // Import existing origin-local preferences once.
    } catch (_) {
      storageNotice = 'Saved settings are unavailable. Changes may last only for this tab.';
    } finally {
      if (!stopped) {
        settingsPending = false;
        refreshState(true);
      }
    }
  }

  function saveSettings(next) {
    if (settingsPending || stopped) return;
    settings = normalizeSettings({ ...settings, ...next });
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); }
    catch (_) { /* Private browsing/storage denial: keep this tab's preferences. */ }
    persistManagedSettings(settings);
    closePopover(false);
    refreshState(true);
  }

  function injectStyles() {
    if (document.querySelector('style' + owned)) return;
    const style = document.createElement('style');
    style.dataset.aiHeuristicStyle = adapter.id;
    style.dataset.aiHeuristicUi = '1';
    style.dataset.aiStyleInstance = instance;
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
    element.dataset.aiStyleInstance = instance;
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function cueTone(analysis) {
    const stamp = analysis.cueAssessment.stamp;
    return stamp === 'high' ? 'high' : stamp === 'low' ? 'low' : 'moderate';
  }

  function stampLabel(analysis) {
    return cueTone(analysis) === 'low' ? 'Possible AI' : 'AI Detected';
  }

  const SENSITIVITY_OPTIONS = [
    ['strict', 'Strict: strong evidence only'],
    ['balanced', 'Balanced: also show Possible AI'],
    ['sensitive', 'Sensitive: lower cut-offs, more false flags']
  ];

  function formatPoints(points) {
    const value = Number.isFinite(points) ? points : 0;
    return (Number.isInteger(value) ? String(value) : value.toFixed(1)) + (value === 1 ? ' point' : ' points');
  }

  function cueCount(cues) {
    return formatPoints(cues.points) + ' · ' + cues.families.length + (cues.families.length === 1 ? ' pattern' : ' patterns');
  }

  const TIER_LABELS = {
    definitive: 'Strong artifact · 3 points',
    moderate: 'Pattern · 1 point',
    supporting: 'Formatting · 0.5 points with another pattern'
  };

  function cancelPopoverClose() {
    if (popoverCloseTimer !== null) window.clearTimeout(popoverCloseTimer);
    popoverCloseTimer = null;
  }

  function schedulePopoverClose() {
    cancelPopoverClose();
    // Allow the pointer to cross the gap into the interactive details panel.
    popoverCloseTimer = window.setTimeout(() => {
      popoverCloseTimer = null;
      if (activePopover && !activePopover.pinned &&
        !activePopover.node.contains(document.activeElement)) closePopover(false);
    }, 220);
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
    badge.appendChild(createElement('span', 'ai-heuristic-badge__text', stampLabel(analysis)));
    badge.setAttribute('aria-label', stampLabel(analysis) + ': ' + cueTone(analysis) + ' signal level. ' +
      cues.families.length + ' of ' + cues.totalFamilies + ' pattern families matched, ' + formatPoints(cues.points) + '. ' +
      cues.coverage.text + '. Writing patterns, not proof of authorship. Open details.');
    badge.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      cancelPopoverClose();
      if (activePopover && (activePopover.badge === badge || activePopover.pinned)) return;
      if (badge.isConnected) openPopover(badge, analysis, false);
    });
    badge.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'touch' && activePopover && activePopover.badge === badge) schedulePopoverClose();
    });
    badge.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activePopover && activePopover.badge === badge) {
        if (activePopover.pinned) closePopover(true);
        else {
          cancelPopoverClose();
          activePopover.pinned = true;
          activePopover.node.querySelector('.ai-heuristic-popover__close').focus({ preventScroll: true });
        }
      } else openPopover(badge, analysis, true);
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
        `Cue rubric: ${cues.families.length}/${cues.totalFamilies} families; ${formatPoints(cues.points)}; stamp ${cues.stamp || 'none'}`,
        `Families: ${cues.families.map((family) => family.id + ' (' + family.tier + ')').join(', ') || 'none'}`,
        `Sample class: ${cues.coverage.text} (${cues.coverage.reason})`,
        analysis.modelAvailable === false ? 'Diagnostic model: unavailable for this platform' :
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
      ['enabled', 'Enable style cues on this site'],
      ['analyzeComments', 'Analyze comments and replies'],
      ['hideInsufficient', 'Hide signals in short samples']
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
    const sensitivityLabel = createElement('label', '', 'Stamp sensitivity');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Stamp sensitivity');
    for (const [value, text] of SENSITIVITY_OPTIONS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = settings.cueSensitivity === value;
      select.appendChild(option);
    }
    select.addEventListener('change', () => saveSettings({ cueSensitivity: select.value }));
    sensitivityLabel.appendChild(select);
    controls.appendChild(sensitivityLabel);
    section.appendChild(controls);
    return section;
  }

  function syncSettingsLauncher() {
    const existing = document.querySelector('.ai-heuristic-launcher' + owned);
    const label = settingsPending ? 'Loading style cue settings…' : settings.enabled ? 'Style cue settings' : 'Style cues off · Settings';
    if (existing) { existing.textContent = label; existing.disabled = settingsPending; return; }
    const launcher = createElement('button', 'ai-heuristic-launcher', label);
    launcher.disabled = settingsPending;
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
      'Settings apply to this website. You can return here even when all badges are hidden.'
    ));
    appendRuntimeNotice(body);
    body.appendChild(createSettingsSection());
    popover.appendChild(body);
    document.body.appendChild(popover);
    activePopover = { node: popover, badge: launcher, pinned: true };
    positionPopover(popover, launcher);
    close.focus({ preventScroll: true });
  }

  function openPopover(badge, analysis, pinned) {
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
    const title = createElement('h2', '', stampLabel(analysis));
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
      ({ high: 'High', moderate: 'Moderate', low: 'Low' })[cueTone(analysis)] + ' signal level · ' + cueCount(cues)));
    if (cues.assessed) {
      body.appendChild(createElement('p', 'ai-heuristic-popover__summary',
        cues.families.length + ' of ' + cues.totalFamilies + ' pattern families matched (' + formatPoints(cues.points) + '). ' +
        'Strong artifacts such as model self-references or unfilled placeholders count 3 points; other patterns count 1; ' +
        'formatting counts 0.5 only alongside another pattern. Moderate starts at 1 point and high at 3. ' +
        'Rhythm and repetition alone need two patterns. Repeated matches within one family count once. ' +
        'Possible AI means some evidence matched, but less than a moderate stamp needs. Sensitivity: ' +
        (SENSITIVITY_OPTIONS.find(([value]) => value === (cues.sensitivity || settings.cueSensitivity)) || SENSITIVITY_OPTIONS[1])[1] + '.'));
    }
    body.appendChild(createElement('p', 'ai-heuristic-popover__summary',
      analysis.metrics.wordCount + ' words · ' + analysis.metrics.sentenceCount + ' sentences or list items. ' + cues.coverage.reason));
    body.appendChild(createElement('p', 'ai-heuristic-popover__notice',
      'These are writing-pattern matches, not proof of AI authorship. Human writing can match them; AI writing can match none. ' +
      'The level adds fixed points per pattern; it is not the probability that AI wrote this text.'));

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
        if (TIER_LABELS[family.tier]) item.appendChild(createElement('span', 'ai-heuristic-cue-tier', TIER_LABELS[family.tier]));
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
    appendRuntimeNotice(body);
    body.appendChild(createSettingsSection());
    body.appendChild(createElement('p', 'ai-heuristic-popover__footer', analysis.disclaimer));
    popover.appendChild(body);
    document.body.appendChild(popover);
    activePopover = { node: popover, badge, pinned };
    popover.addEventListener('pointerenter', cancelPopoverClose);
    popover.addEventListener('pointerleave', schedulePopoverClose);
    popover.addEventListener('focusin', cancelPopoverClose);
    popover.addEventListener('focusout', schedulePopoverClose);
    popover.addEventListener('click', () => {
      if (activePopover && activePopover.node === popover) activePopover.pinned = true;
    });
    positionPopover(popover, badge);
    popover.dataset.entry = 'stamp';
    if (pinned) close.focus({ preventScroll: true });
  }

  function positionPopover(popover, badge) {
    const rect = badge.getBoundingClientRect();
    const margin = 12;
    const width = Math.max(0, Math.min(380, window.innerWidth - margin * 2));
    popover.style.width = `${width}px`;
    let left;
    if (rect.right + 8 + width <= window.innerWidth - margin) left = rect.right + 8;
    else if (rect.left - 8 - width >= margin) left = rect.left - 8 - width;
    else left = clamp(rect.left, margin, window.innerWidth - width - margin);
    let top = rect.bottom + 8;
    const height = popover.offsetHeight;
    if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - height - 8);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.transformOrigin = `${clamp(rect.left + rect.width / 2 - left, 0, width)}px ${clamp(rect.top + rect.height / 2 - top, 0, height)}px`;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function closePopover(restoreFocus) {
    cancelPopoverClose();
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
    const stamp = typeof cues.stamp === 'string' ? cues.stamp : cues.families.length ? 'moderate' : 'none';
    return !cues.assessed || stamp === 'none' || (settings.hideInsufficient && cues.coverage.level === 'short');
  }

  function sizeStamp(badge, host) {
    badge.style.removeProperty('--aih-stamp-font-size');
    const style = window.getComputedStyle(host);
    const fontSize = parseFloat(style.fontSize) || 16;
    let lineHeight = parseFloat(style.lineHeight);
    if (/^[\d.]+$/.test(style.lineHeight)) lineHeight *= fontSize;
    if (style.lineHeight === 'normal') {
      // "normal" depends on the host font. Measure its line box instead of
      // assuming a multiplier that would make the stamp taller than the post.
      const probe = createElement('span', '', 'M');
      probe.dataset.aiHeuristicUi = '1';
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;display:block;font:inherit;line-height:normal;padding:0;border:0;margin:0;width:max-content;height:auto;';
      host.appendChild(probe);
      lineHeight = probe.getBoundingClientRect().height;
      probe.remove();
    }
    if (!lineHeight || !Number.isFinite(lineHeight)) lineHeight = fontSize * 1.5;
    badge.style.setProperty('--aih-post-font-size', fontSize + 'px');
    badge.style.setProperty('--aih-post-line-height', lineHeight + 'px');
    // Narrow nested replies still show the whole stamp on one line. Scale its
    // lettering only when needed; the outer height continues to match the post.
    const badgeStyle = window.getComputedStyle(badge);
    const available = badge.clientWidth - (parseFloat(badgeStyle.paddingLeft) || 0) - (parseFloat(badgeStyle.paddingRight) || 0);
    const textWidth = badge.firstElementChild.getBoundingClientRect().width;
    if (available > 0 && textWidth > available) {
      badge.style.setProperty('--aih-stamp-font-size', (fontSize * .625 * available / textWidth) + 'px');
    }
  }

  function kindFor(element) {
    const kind = adapter.kindForElement ? adapter.kindForElement(element) : element.matches(adapter.commentSelector) ? 'comment' : 'post';
    if (kind !== 'post' && kind !== 'comment') throw new Error('Invalid content kind');
    return kind;
  }

  function processElement(element) {
    if (stopped || !running || !element.isConnected || !analysisAllowed()) return;
    const kind = kindFor(element);
    if (!adapter.isTopLevel(element, kind) || (kind === 'comment' && !settings.analyzeComments)) {
      removeRecord(element);
      return;
    }
    const content = adapter.extractContent(element, kind) || { text: '', excluded: { quotes: 0, code: 0 } };
    const { text, excluded } = content;
    const textHost = content.textHost || content.host || element;
    if (typeof text !== 'string' || !excluded || !['quotes', 'code'].every((key) =>
      Number.isInteger(excluded[key]) && excluded[key] >= 0)) throw new Error('Invalid adapter content');
    const previous = records.get(element);
    if (!text && !excluded.quotes && !excluded.code) {
      if (previous && previous.badge) {
        if (activePopover && activePopover.badge === previous.badge) closePopover(false);
        previous.badge.remove();
      }
      records.delete(element);
      return;
    }
    const links = Array.isArray(content.links) ? content.links.filter((href) => typeof href === 'string').slice(0, 20) : [];
    const cacheKey = kind + '\n' + excluded.quotes + ':' + excluded.code + '\n' + settings.cueSensitivity + '\n' + links.join(' ') + '\n' + text;
    const fingerprint = hashText(cacheKey);
    if (previous && previous.fingerprint === fingerprint && previous.text === text &&
      (!previous.badge || previous.badge.isConnected)) {
      if (previous.badge) adapter.placeBadge(element, previous.badge, kind, content);
      if (previous.badge && previous.textHost !== textHost) {
        previous.textHost = textHost;
        sizeStamp(previous.badge, textHost);
      }
      return;
    }
    if (previous && previous.badge) {
      if (activePopover && activePopover.badge === previous.badge) closePopover(false);
      previous.badge.remove();
    }
    let analysis = analysisCache.get(cacheKey);
    if (!analysis) {
      analysis = engine.analyze(text, { kind, excluded, links, rendersMarkdown: adapter.rendersMarkdown === true }, settings);
      analysisCache.set(cacheKey, analysis);
      if (analysisCache.size > 128) analysisCache.delete(analysisCache.keys().next().value);
    }
    if (shouldHide(analysis)) {
      records.set(element, { fingerprint, text, badge: null, analysis });
      return;
    }
    const badge = createBadge(analysis);
    try {
      adapter.placeBadge(element, badge, kind, content);
      sizeStamp(badge, textHost);
    }
    catch (error) { badge.remove(); throw error; }
    records.set(element, { fingerprint, text, badge, analysis, textHost });
  }

  function flushQueue() {
    queueTimer = null;
    if (stopped || !running) return;
    if (!analysisAllowed()) { refreshState(); return; }
    const start = performance.now();
    let count = 0;
    for (const element of pending) {
      pending.delete(element);
      if (!intersectionObserver || visible.has(element)) {
        dirty.delete(element);
        processSafely(element);
      }
      count += 1;
      if (count >= 8 || performance.now() - start >= 8) break;
    }
    if (pending.size) scheduleQueue();
  }

  function scheduleQueue() {
    if (stopped || !running || queueTimer !== null) return;
    queueTimer = window.setTimeout(flushQueue, 30);
  }

  function trackCandidate(element) {
    if (!element.isConnected || !adapter.isTopLevel(element, kindFor(element))) {
      untrack(element);
      return;
    }
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

  function reportFailure(phase) {
    if (reportedFailures.has(phase)) return;
    reportedFailures.add(phase);
    console.warn('[Style cues] Skipped an adapter operation: ' + adapter.id + '/' + phase);
  }

  function removeRecord(element) {
    const record = records.get(element);
    if (record && record.badge) {
      if (activePopover && activePopover.badge === record.badge) closePopover(false);
      record.badge.remove();
    }
    records.delete(element);
  }

  function untrack(element) {
    removeRecord(element);
    tracked.delete(element);
    pending.delete(element);
    dirty.delete(element);
    visible.delete(element);
    if (intersectionObserver) intersectionObserver.unobserve(element);
  }

  function processSafely(element) {
    try { processElement(element); }
    catch (_) { removeRecord(element); reportFailure('candidate'); }
  }

  function track(element) {
    if (!running) return;
    try { trackCandidate(element); }
    catch (_) { removeRecord(element); reportFailure('discovery'); }
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

  function candidateAncestors(target) {
    const ancestors = [];
    let element = target && target.closest(candidateSelector);
    while (element) {
      ancestors.push(element);
      element = element.parentElement && element.parentElement.closest(candidateSelector);
    }
    return ancestors;
  }

  function onMutations(mutations) {
    if (stopped || !running) return;
    if (!analysisAllowed() || location.href !== lastUrl) { refreshState(true); return; }
    if (mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) =>
      node.nodeType === 1 && !node.dataset.aiStyleInstance && detectLegacy(node)))) { refreshState(true); return; }
    let removedContent = false;
    for (const mutation of mutations) {
      if (isOwnUI(mutation.target)) continue;
      const changed = [...mutation.addedNodes, ...mutation.removedNodes];
      const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
      if (target && tracked.has(target) && !target.matches(candidateSelector)) {
        untrack(target);
      }
      const owners = candidateAncestors(target);
      if (mutation.type === 'childList' && changed.length && changed.every(isOwnUI)) {
        for (const owner of owners) {
          const record = records.get(owner);
          if (!record) continue;
          if (record.badge && !record.badge.isConnected) track(owner);
          break;
        }
        continue;
      }
      // A nested selector match may be a text marker or quoted card rejected
      // by the adapter. Walk only its ancestors to reach the actual owner.
      for (const owner of owners) {
        track(owner);
        if (tracked.has(owner)) break;
      }
      mutation.addedNodes.forEach((node) => discover(node));
      if (mutation.removedNodes.length) removedContent = true;
    }
    if (removedContent) {
      for (const element of tracked) {
        if (element.isConnected) continue;
        untrack(element);
      }
    }
  }

  // Explicit synchronous scan for development/tests; live updates are targeted.
  function scanNow() {
    if (stopped) return;
    refreshState();
    if (!running) return;
    document.querySelectorAll(candidateSelector).forEach((element) => {
      track(element);
      pending.delete(element);
      dirty.delete(element);
      processSafely(element);
    });
  }

  function resetAndRescan() { refreshState(true); }

  function appendRuntimeNotice(parent) {
    if (notice) parent.appendChild(createElement('p', 'ai-heuristic-popover__notice', notice));
    if (storageNotice) parent.appendChild(createElement('p', 'ai-heuristic-popover__notice', storageNotice));
    if (!routeSupported()) parent.appendChild(createElement('p', 'ai-heuristic-popover__summary', 'Style cues are inactive on this page.'));
  }

  function setNotice(message, block = false) {
    notice = message;
    legacyBlocked = legacyBlocked || block;
    refreshState(block);
  }

  function detectLegacy(root = document) {
    if (legacyBlocked) return true;
    const selector = '.ai-heuristic-badge[data-ai-platform="' + adapter.id + '"]:not([data-ai-style-instance]), style[data-ai-heuristic-style="' + adapter.id + '"]:not([data-ai-style-instance])';
    const legacy = (root.matches && root.matches(selector)) || root.querySelector(selector);
    if (!legacy) return false;
    legacyBlocked = true;
    notice = 'An older site script is still active. Disable it in Userscripts and refresh this page to use the combined release. Its running observers cannot be disabled by this script.';
    return true;
  }

  function routeSupported() {
    try { return !options.routeSupported || options.routeSupported(new URL(location.href)); }
    catch (_) { reportFailure('route'); return false; }
  }

  function analysisAllowed() { return !settingsPending && !navigationPending && settings.enabled && !legacyBlocked && routeSupported(); }

  function suspendAnalysis() {
    running = false;
    if (observer) observer.disconnect();
    if (intersectionObserver) intersectionObserver.disconnect();
    observer = null;
    intersectionObserver = null;
    if (queueTimer !== null) window.clearTimeout(queueTimer);
    queueTimer = null;
    tracked.clear();
    dirty.clear();
    pending.clear();
    visible = new WeakSet();
    records = new WeakMap();
    analysisCache.clear();
    closePopover(false);
    document.querySelectorAll('.ai-heuristic-badge' + owned).forEach((badge) => badge.remove());
  }

  function refreshState(force = false) {
    if (stopped || !started || !document.body) return;
    const changed = bodyReference !== document.body || lastUrl !== location.href;
    lastUrl = location.href;
    bodyReference = document.body;
    detectLegacy();
    const allowed = analysisAllowed();
    if (force || changed || (running && !allowed)) suspendAnalysis();
    injectStyles();
    syncSettingsLauncher();
    if (allowed && !running) startAnalysis();
  }

  function checkLocation() {
    if (location.href !== lastUrl || document.body !== bodyReference) refreshState(true);
  }

  function onNavigationStart() {
    navigationPending = true;
    refreshState(true);
  }

  function onNavigationFinish() {
    navigationPending = false;
    refreshState(true);
  }

  function onDocumentClick(event) {
    if (activePopover && !activePopover.node.contains(event.target) && !activePopover.badge.contains(event.target)) closePopover(false);
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && activePopover) closePopover(true);
  }

  function onViewportChange(event) {
    closePopover(false);
    if (event.type === 'resize') {
      for (const element of tracked) {
        const record = records.get(element);
        if (record && record.badge && record.textHost.isConnected) sizeStamp(record.badge, record.textHost);
      }
    }
  }

  function startAnalysis() {
    running = true;
    if (typeof window.IntersectionObserver === 'function') {
      intersectionObserver = new IntersectionObserver((entries) => {
        if (stopped || !running) return;
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
      attributes: true, attributeFilter: [...new Set(['lang', 'class', 'role', 'data-testid', 'slot', ...(adapter.observedAttributes || [])])]
    });
  }

  function start() {
    if (started || stopped || !document.body) return;
    started = true;
    try {
      rootObserver = new MutationObserver(() => refreshState());
      rootObserver.observe(document.documentElement, { childList: true });
      // Poll only the URL/body references: works in isolated worlds without
      // patching the site's history methods or repeatedly scanning its DOM.
      routeTimer = window.setInterval(checkLocation, 1000);
      window.addEventListener('popstate', checkLocation);
      window.addEventListener('hashchange', checkLocation);
      window.addEventListener('pageshow', checkLocation);
      if (adapter.navigationEvents) {
        document.addEventListener(adapter.navigationEvents.start, onNavigationStart);
        document.addEventListener(adapter.navigationEvents.finish, onNavigationFinish);
      }
      refreshState();
      document.addEventListener('click', onDocumentClick, true);
      document.addEventListener('keydown', onKeydown);
      window.addEventListener('resize', onViewportChange, { passive: true });
      window.addEventListener('scroll', onViewportChange, { passive: true });
    } catch (error) {
      stop();
      throw error;
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    suspendAnalysis();
    if (rootObserver) rootObserver.disconnect();
    if (routeTimer !== null) window.clearInterval(routeTimer);
    document.removeEventListener('DOMContentLoaded', start);
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange);
    window.removeEventListener('popstate', checkLocation);
    window.removeEventListener('hashchange', checkLocation);
    window.removeEventListener('pageshow', checkLocation);
    if (adapter.navigationEvents) {
      document.removeEventListener(adapter.navigationEvents.start, onNavigationStart);
      document.removeEventListener(adapter.navigationEvents.finish, onNavigationFinish);
    }
    document.querySelectorAll('style' + owned + ', .ai-heuristic-launcher' + owned).forEach((node) => node.remove());
    if (options.onStop) options.onStop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  loadManagedSettings();

  return {
    scanNow, resetAndRescan, stop, setNotice,
    getStatus: () => ({ running, stopped, legacyBlocked }),
    getSettings: () => ({ ...settings }),
    getAnalysis: (element) => records.get(element) && records.get(element).analysis,
    engine
  };
}

/**
 * @typedef {Object} AIContent
 * @property {string} text Author-owned text with structural boundaries.
 * @property {{quotes: number, code: number}} excluded Removed DOM sections.
 * @property {Element|null} [host] Optional badge placement hint.
 *
 * @typedef {Object} AIPlatformAdapter
 * @property {string} id Stable registry/storage/model identity.
 * @property {string} name Display name.
 * @property {string} postSelector
 * @property {string} commentSelector
 * @property {(element: Element) => ('post'|'comment')} [kindForElement]
 * @property {(element: Element, kind: string) => boolean} isTopLevel
 * @property {(element: Element, kind: string) => AIContent|null} extractContent
 * @property {(element: Element, badge: Element, kind: string, content: AIContent) => void} placeBadge
 * @property {string[]} [observedAttributes] Extra candidate-affecting attributes.
 * @property {boolean} [rendersMarkdown] True when the site renders Markdown, so literal `**bold**` cannot be a paste artifact.
 * @property {(url: URL) => boolean} [supportsUrl] Additional route eligibility.
 * @property {{start: string, finish: string}} [navigationEvents] Document events bracketing SPA page replacement.
 * Factories must be side-effect-free. Scheduling, UI, storage and analysis belong
 * to the runtime. Null/empty extraction removes a previously attached badge.
 */

function aiHostMatches(hostname, pattern) {
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2);
    return hostname === base || hostname.endsWith('.' + base);
  }
  return hostname === pattern;
}

function validateAIAdapter(adapter, entry) {
  if (!adapter || adapter.id !== entry.id || typeof adapter.name !== 'string') throw new Error('Invalid adapter identity');
  for (const name of ['postSelector', 'commentSelector']) {
    if (typeof adapter[name] !== 'string' || !adapter[name].trim()) throw new Error('Missing candidate selector');
    document.createElement('div').querySelectorAll(adapter[name]);
  }
  for (const name of ['isTopLevel', 'extractContent', 'placeBadge']) {
    if (typeof adapter[name] !== 'function') throw new Error('Missing adapter method');
  }
  for (const name of ['kindForElement', 'supportsUrl']) {
    if (adapter[name] !== undefined && typeof adapter[name] !== 'function') throw new Error('Invalid optional adapter method');
  }
  if (adapter.rendersMarkdown !== undefined && typeof adapter.rendersMarkdown !== 'boolean') {
    throw new Error('Invalid rendersMarkdown flag');
  }
  if (adapter.observedAttributes !== undefined && (!Array.isArray(adapter.observedAttributes) ||
    adapter.observedAttributes.some((name) => typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)))) {
    throw new Error('Invalid observed attributes');
  }
  if (adapter.navigationEvents !== undefined) {
    const events = adapter.navigationEvents;
    if (!events || !['start', 'finish'].every(key => typeof events[key] === 'string' && /^[a-z][a-z0-9-]*$/.test(events[key])) || events.start === events.finish) {
      throw new Error('Invalid navigation events');
    }
  }
  return adapter;
}

function bootAIHeuristic(registry, factories, models, release) {
  const url = new URL(location.href);
  if (url.protocol !== 'https:' || window.top !== window.self) return null;
  const matches = registry.filter((entry) => entry.status !== 'planned' && entry.hosts.some((host) => aiHostMatches(url.hostname, host)));
  if (matches.length !== 1) return null;
  const entry = matches[0];
  let controller = null;
  let marker = null;
  let stopped = false;
  let status = 'waiting';
  const instance = 'aih-' + Math.random().toString(36).slice(2);
  const selector = 'meta[data-ai-style-owner="' + entry.id + '"]';
  const hint = 'Multiple script installations were found. Keep the combined script enabled and disable the older site scripts in Userscripts, then refresh.';
  const supportNotice = entry.status === 'experimental' ? entry.name + ' support is experimental. Some posts or comments may be skipped.' : '';
  const notice = (duplicate) => [supportNotice, duplicate ? hint : ''].filter(Boolean).join(' ');

  function rank(version, distribution) {
    return version.split('.').map(Number).concat(distribution === 'combined' ? 1 : 0);
  }
  function compare(left, right) {
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return left[i] - right[i];
    }
    return 0;
  }
  function ping() { marker.setAttribute('data-ai-alive', '1'); }
  function duplicate() { if (controller) controller.setNotice(notice(true)); }
  function releaseOwnership() {
    if (!marker) return;
    marker.removeEventListener('ai-style-ping', ping);
    marker.removeEventListener('ai-style-retire', stop);
    marker.removeEventListener('ai-style-duplicate', duplicate);
    marker.remove();
    marker = null;
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    status = 'stopped';
    document.removeEventListener('DOMContentLoaded', launch);
    if (controller) controller.stop();
    releaseOwnership();
  }
  function launch() {
    if (stopped || !document.body) return;
    let adapter;
    try {
      adapter = validateAIAdapter(factories[entry.id](), entry);
    } catch (_) {
      status = 'failed';
      console.warn('[Style cues] Adapter could not start: ' + entry.id);
      return;
    }
    let coexistence = false;
    const prior = document.querySelector(selector);
    if (prior) {
      prior.removeAttribute('data-ai-alive');
      prior.dispatchEvent(new Event('ai-style-ping'));
      if (prior.getAttribute('data-ai-alive') === '1') {
        coexistence = prior.dataset.distribution !== release.distribution;
        const previousVersion = prior.dataset.version || '0.0.0';
        if (compare(rank(release.version, release.distribution), rank(previousVersion, prior.dataset.distribution)) <= 0) {
          if (coexistence) prior.dispatchEvent(new Event('ai-style-duplicate'));
          status = 'superseded';
          return;
        }
        prior.dispatchEvent(new Event('ai-style-retire'));
      }
      prior.remove();
    }
    marker = document.createElement('meta');
    marker.dataset.aiStyleOwner = entry.id;
    marker.dataset.aiHeuristicUi = '1';
    marker.dataset.instance = instance;
    marker.dataset.version = release.version;
    marker.dataset.distribution = release.distribution;
    marker.addEventListener('ai-style-ping', ping);
    marker.addEventListener('ai-style-retire', stop);
    marker.addEventListener('ai-style-duplicate', duplicate);
    // Keep ownership outside replaceable feed/body/head trees.
    document.documentElement.appendChild(marker);
    try {
      controller = startAIHeuristic(adapter, models, {
        instance,
        notice: notice(coexistence),
        enabledByDefault: entry.status !== 'experimental',
        settingsStorage: entry.settingsStorage,
        routeSupported(current) {
          return !entry.excludedPaths.some((path) => current.pathname === path || current.pathname.startsWith(path + '/')) &&
            (!adapter.supportsUrl || adapter.supportsUrl(current));
        },
        onStop() { status = 'stopped'; releaseOwnership(); }
      });
      status = 'active';
    } catch (_) {
      status = 'failed';
      releaseOwnership();
      console.warn('[Style cues] Runtime could not start: ' + entry.id);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', launch, { once: true });
  else launch();
  return { stop, getController: () => controller, getStatus: () => status };
}

  const factories = {
"linkedin": function () {
function createPlatformAdapter() {
  'use strict';

  const feedChildSelector = '[data-testid="mainFeed"] > div';
  const modernPostSelector = '[role="listitem"]:has([data-testid="expandable-text-box"])';
  const cardSelector = [
    modernPostSelector,
    'div.feed-shared-update-v2',
    'article[data-urn*="urn:li:activity"]',
    'main article[data-id*="urn:li:activity"]'
  ].join(', ');
  const postSelector = feedChildSelector + ', ' + cardSelector;
  const commentSelector = [
    'li.comments-comment-item',
    'div.comments-comment-item',
    'article.comments-comment-item',
    'div.comments-comments-list__comment-item',
    'div.comments-comment-entity',
    'li.update-components-comment',
    'div.update-components-comment'
  ].join(', ');
  const postTextSelector = [
    '[data-testid="expandable-text-box"]',
    'div.feed-shared-inline-show-more-text',
    'div.update-components-text-view',
    'div.update-components-update-v2__commentary',
    'div.update-components-text',
    'div.feed-shared-update-v2__description',
    'div.feed-shared-update-v2__commentary',
    '[data-test-id="main-feed-activity-card__commentary"]'
  ].join(', ');
  const commentTextSelector = [
    'span.comments-comment-item__main-content',
    'div.comments-comment-item__main-content',
    'div.comments-comment-entity__text',
    'span.comments-comment-entity__text',
    'span.update-components-comment__text',
    'div.update-components-comment__text'
  ].join(', ');

  function linkedinTextContent(node) {
    // The DOM walk includes text hidden only by visual line clamping.
    return aiHeuristicTextContent(node);
  }

  function bestOwnedText(root, selector, kind) {
    let best = { text: '', excluded: { quotes: 0, code: 0 }, host: null };
    root.querySelectorAll(selector).forEach((candidate) => {
      if (kind === 'post' && candidate.closest(commentSelector)) return;
      if (kind === 'comment' && candidate.closest(commentSelector) !== root) return;
      if (candidate.closest('blockquote, pre, code, .update-components-mini-update-v2')) return;
      const content = aiHeuristicReadContent(candidate);
      if (content.text.length > best.text.length || (!best.host && content.excluded.quotes + content.excluded.code)) {
        best = { ...content, host: candidate };
      }
    });
    if (!best.host && kind === 'post') {
      const fallback = findPostTextHost(root);
      if (fallback) best = { ...aiHeuristicReadContent(fallback), host: fallback };
    }
    return best;
  }

  function findPostTextHost(root) {
    const direct = Array.from(root.querySelectorAll(postTextSelector))
      .filter((candidate) => !candidate.closest(commentSelector) && !candidate.closest('blockquote, pre, code, .update-components-mini-update-v2'))
      .sort((left, right) => linkedinTextContent(right).length - linkedinTextContent(left).length)[0];
    if (direct) return direct;

    // LinkedIn periodically replaces semantic commentary classes with generated ones,
    // especially in profile activity and search views. Choose the largest text-focused
    // descendant while excluding actor, engagement, comment, and action containers.
    return Array.from(root.querySelectorAll('div, span'))
      .filter((candidate) => {
        if (candidate.closest(commentSelector)) return false;
        if (candidate.closest('blockquote, pre, code, .update-components-mini-update-v2')) return false;
        if (candidate.closest('.update-components-actor__container, .feed-shared-actor__container')) return false;
        if (candidate.closest('.social-details-social-counts, .feed-shared-social-action-bar')) return false;
        const text = linkedinTextContent(candidate);
        return text.length >= 40 && candidate.querySelectorAll('button, [role="button"]').length <= 1;
      })
      .sort((left, right) => linkedinTextContent(right).length - linkedinTextContent(left).length)[0] || null;
  }

  return {
    id: 'linkedin',
    name: 'LinkedIn',
    observedAttributes: ['data-urn', 'data-id'],
    postSelector,
    commentSelector,
    isTopLevel(element, kind) {
      if (kind === 'comment') return true;
      // Current feeds put visible list-item cards inside display:contents
      // wrappers. Observe the cards, since those wrappers have no viewport box.
      if (element.matches(feedChildSelector) && !element.matches(cardSelector) && element.querySelector(cardSelector)) return false;
      const ownershipSelector = element.matches(cardSelector) ? cardSelector : postSelector;
      const parentPost = element.parentElement && element.parentElement.closest(ownershipSelector);
      return !parentPost && !element.closest(commentSelector);
    },
    extractContent(element, kind) {
      return bestOwnedText(element, kind === 'comment' ? commentTextSelector : postTextSelector, kind);
    },
    placeBadge(element, badge, kind, content) {
      const textHost = content && content.host || findPostTextHost(element);
      const selectors = kind === 'comment'
        ? ['.comments-comment-meta__description-title', '.comments-comment-entity__author', '.comments-comment-item__post-meta a[href]']
        : ['.update-components-actor__title', '.update-components-actor__name', '.feed-shared-actor__name', '.update-components-actor__meta',
          // Modern author links contain the name/degree in block text. Prefer
          // them over the earlier inline "followed by" or reaction context.
          'a[href*="/in/"]:has(p), a[href*="/company/"]:has(p), a[href*="/showcase/"]:has(p)',
          'a[href*="/in/"]:has(> div), a[href*="/company/"]:has(> div), a[href*="/showcase/"]:has(> div)',
          'h1, h2, h3'];
      let header;
      for (const selector of selectors) {
        header = Array.from(element.querySelectorAll(selector)).find(node =>
          (!textHost || (!textHost.contains(node) && Boolean(node.compareDocumentPosition(textHost) & 4))) &&
          !node.closest('blockquote, pre, code, .update-components-mini-update-v2, [hidden], [aria-hidden="true"]') &&
          (kind === 'comment' ? node.closest(commentSelector) === element : !node.closest(commentSelector)) &&
          aiHeuristicTextContent(node).trim());
        if (header) break;
      }
      aiHeuristicPlaceHeaderBadge(element, badge, header, textHost);
    }
  };
}
return createPlatformAdapter();
}
  };
  bootAIHeuristic([{"id":"linkedin","name":"LinkedIn","hosts":["www.linkedin.com","linkedin.com","*.linkedin.com","m.linkedin.com"],"status":"stable","capabilities":["feed","profile activity","permalinks","comments","collapsed text"],"excludedPaths":["/messaging"]}], factories, {"schema_version":2,"metadata":{"version":"0.2.0","calibrated":false,"provenance":"Hand-tuned experimental baseline retained for continuity; weights are unchanged as feature definitions evolve. Replace with offline-trained and held-out calibrated models before treating scores as probabilities.","feature_set":"stylometry-v4-charhash128"},"models":{"linkedin:post":{"intercept":-0.35,"weights":{"aiHedgePresent":2.2,"buzzPer100w":1.0,"templatePer100w":0.9,"discoursePer100w":0.7,"bigramRepeatRatio":1.1,"trigramRepeatRatio":0.7,"sentenceStarterRepeatRatio":0.6,"mattr25":-0.8,"sentenceLenCV":-0.8,"avgSentenceLen":0.6,"wordLenCV":-0.2,"paragraphLenCV":-0.15,"contractionRatio":-0.15,"listMarkerCount":0.45,"colonPer100w":0.25,"commaPer100w":0.18,"exclamationsPer100w":0.12,"topWordShare":0.25},"calibration":null,"thresholds":{"moderate":0.55,"strong":0.72,"target_fpr":null,"method":"experimental-default"}},"linkedin:comment":{"intercept":-0.55,"weights":{"aiHedgePresent":2.0,"templatePer100w":0.8,"discoursePer100w":0.55,"bigramRepeatRatio":0.95,"trigramRepeatRatio":0.55,"sentenceStarterRepeatRatio":0.5,"mattr25":-0.7,"sentenceLenCV":-0.75,"avgSentenceLen":0.55,"wordLenCV":-0.15,"contractionRatio":-0.15,"exclamationsPer100w":0.1,"topWordShare":0.2},"calibration":null,"thresholds":{"moderate":0.57,"strong":0.75,"target_fpr":null,"method":"experimental-default"}}}}, {version:"0.10.0",distribution:"targeted"});
})();
