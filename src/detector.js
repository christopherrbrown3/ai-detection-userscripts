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
    'repeated-openings': { tier: 'moderate', evidence: 'structure' },
    'sentence-uniformity': { tier: 'moderate', evidence: 'structure' },
    'content-repetition': { tier: 'moderate', evidence: 'structure' },
    'structured-presentation': { tier: 'supporting', evidence: 'structure' },
    typography: { tier: 'supporting', evidence: 'structure' }
  };
  const TIER_POINTS = { definitive: 3, moderate: 1, supporting: 0.5 };
  const STAMP_POINTS = { moderate: 1, high: 3 };

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
    phrasing: compileTerms(LLM_PHRASING, false)
  };

  const KNOWLEDGE_DISCLAIMER = /\b(?:as of my (?:last|latest|most recent) (?:knowledge |training )?(?:update|cutoff|cut-off|training(?: data)?)|my (?:knowledge|training(?: data)?) (?:cutoff|cut-off)|up to my (?:last |latest )?(?:knowledge |training )?(?:update|cutoff|cut-off)|i (?:don't|do not) have (?:access to )?(?:real-time|current|live) (?:information|data|updates)|i (?:don't|do not) have (?:the ability to browse|browsing capabilities|access to the internet)|i (?:don't|do not|cannot) have personal (?:opinions|feelings|beliefs|emotions|experiences|preferences))/gi;
  const ASSISTANT_OPENER = /^[ \t]*(?:certainly|sure|absolutely|of course)[!,.][ \t]*(?:here(?:'s| is| are)|i(?:'d| would) be (?:happy|glad) to)\b/gim;
  const DELIVERY_LINE = /^[ \t]*here(?:'s| is| are)[ \t]+(?:a|an|the|your|some|two|three|a few)[ \t]+(?:(?:revised|polished|refined|rewritten|updated|improved|shorter|longer|final|possible|sample|suggested|professional|engaging|catchy|concise|formal|casual|friendly|optimized|linkedin|twitter|facebook|instagram|youtube|social media|new|short|brief|quick)[ \t]+){0,2}(?:version|draft|post|tweet|thread|caption|reply|response|comment|message|email|bio|summary|rewrite|rewording|paraphrase)s?\b[^\n:]{0,60}:/gim;
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

  // "Not X, but Y" surface patterns. The first ten are ported from slop-score
  // js/regexes-stage1.js, https://github.com/sam-paech/slop-score, under this notice:
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
      `${START}\\s*${Q}(?:(?:${PRON}\\s+${BE}\\s+not)|(?:${PRON}\\s+${BE}n't)|(?:it's|they're|that's)\\s+not)\\b[^.?!]{0,${MAXG}}[.;:?!]\\s*${Q}${PRON}\\s+(?:${BE}|(?:'s|'re))\\b(?!\\s+not\\b)`,
      `${START}\\s*${REPORTER}(?!\\s*not\\s+without\\b)(?![^.?!]{0,50}\\bnot\\s+put\\b)[^.?!]{0,${MAXG}}?\\b(?:${BE_NEG})\\b[^.?!]{0,${MAXG}}[.;:?!]\\s*${Q}${PRON}\\b(?:'re|\\s+(?:are|were|is|was))\\b(?!\\s+not\\b)`,
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
    ].map((source) => new RegExp(source, 'gi'));
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

  function scoreFamilies(families, coverage, assessed) {
    const counts = { definitive: 0, moderate: 0, supporting: 0 };
    for (const family of families) counts[family.tier] += 1;
    const core = counts.definitive * TIER_POINTS.definitive + counts.moderate * TIER_POINTS.moderate;
    const points = core + (core > 0 ? counts.supporting * TIER_POINTS.supporting : 0);
    let stamp = 'none';
    if (assessed) {
      if (coverage.level === 'short') stamp = counts.definitive ? 'high' : 'none';
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
      if (stamp !== 'none' && !decisive.some((family) => family.evidence !== 'structure') && decisive.length < 2) stamp = 'none';
    }
    return { counts, points, stamp };
  }

  function analyzeStyleCues(rawText, extracted, context) {
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
    function add(id, name, detail, spans) {
      const info = FAMILY_INFO[id];
      families.push({ id, name, detail, spans: spans.slice(0, 8), tier: info.tier, evidence: info.evidence, points: TIER_POINTS[info.tier] });
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
      const effective = strong + (weak.length >= 3 ? weak.length : 0);
      const needed = Math.max(2, Math.ceil(proseWordCount / 120));
      const buzzSpans = termSpans(parsed, COMPILED.buzz);
      const distinctBuzz = new Set(buzzSpans.map((span) => span.key));
      if (effective >= needed || (strong >= 1 && distinctBuzz.size >= 2)) {
        add('formulaic-framing', 'Stock framing phrases',
          strong + ' distinct framing phrase' + (strong === 1 ? '' : 's') + ' (' + needed + ' needed at this length); ' +
            weak.length + ' common phrases counted only in threes; ' + distinctBuzz.size + ' promotional terms.',
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
      const contrastWeight = pivots.length + balanced.length + (notBut.length - balanced.length) / 2;
      if ((contrastWeight >= 2 && proseWordCount >= 30) || contrastWeight >= 3) {
        const contrasts = mergeOverlapping([...pivots, ...notBut]);
        add('contrast-framing', 'Repeated contrast pivots',
          contrasts.length + ' "not X, but Y" or "it isn\'t X. It\'s Y" constructions. People use them too; repetition is the signal.', contrasts);
      }

      const vocabulary = termSpans(parsed, COMPILED.vocabulary);
      const distinctVocabulary = new Set(vocabulary.map((span) => span.key));
      if (distinctVocabulary.size >= 3 && distinctVocabulary.size * 100 / Math.max(1, extracted.metrics.wordCount) >= 1) {
        add('ai-vocabulary', 'Words LLMs overuse',
          distinctVocabulary.size + ' distinct words that chatbots use far more than people (for example delve, tapestry, pivotal). One or two can be coincidence.',
          vocabulary);
      }

      const phrasing = termSpans(parsed, COMPILED.phrasing);
      if (phrasing.length >= 2) {
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
        return spans.length >= 3 || tokens.length >= 4;
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
    const score = scoreFamilies(families, coverage, assessed);
    const level = !assessed ? 'unassessed' : score.stamp === 'high' ? 'cue-high' : score.stamp === 'moderate' ? 'cue-moderate' :
      families.length ? 'cue-weak' : 'cue-none';
    return {
      level, text: assessed ? families.length + ' matched' : 'Not assessed',
      families, totalFamilies: Object.keys(FAMILY_INFO).length, coverage, assessed,
      points: score.points, stamp: score.stamp, tierCounts: score.counts
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
    const cueAssessment = analyzeStyleCues(rawText, extracted, safeContext);
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
