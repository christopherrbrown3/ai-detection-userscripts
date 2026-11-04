// Research signals for the "measure before shipping" methods in the 0.10
// accuracy review. They are NOT bundled into the userscripts and never affect
// a stamp. scripts/evaluate_rubric.mjs --research reports their separation on
// labeled data; a later release may promote one only after it is measured.
//
// Everything is training-free and browser-compatible plain JavaScript. The
// compressor is injected so the same code can use Node's zlib in the harness
// or CompressionStream('deflate-raw') in a browser.

// ZipPy (https://github.com/thinkst/zippy, MIT, Copyright (c) 2023 Thinkst
// Applied Research): clean_text() and the zlib engine's chunked prelude score.
export function zippyCleanText(text) {
  return String(text || '')
    .replace(/ +/g, ' ')
    .replace(/\t/g, '')
    .replace(/\n+/g, '\n')
    .replace(/\n /g, '\n')
    .replace(/ \n/g, '\n')
    .replace(/[^0-9A-Za-z,.() \n]/g, '');
}

// numpy.array_split semantics: k nearly equal groups, larger groups first.
function arraySplit(items, parts) {
  const groups = [];
  const base = Math.floor(items.length / parts);
  const extra = items.length % parts;
  let index = 0;
  for (let part = 0; part < parts; part += 1) {
    const size = base + (part < extra ? 1 : 0);
    groups.push(items.slice(index, index + size));
    index += size;
  }
  return groups;
}

export function createZippyScorer({ seedText, deflateRawSize, windowBits = 15 }) {
  const prelude = zippyCleanText(seedText);
  const chunks = arraySplit(prelude.split('\n'), Math.ceil(prelude.length / 2 ** windowBits)).map((lines) => lines.join('\n'));
  const ratio = (text) => {
    const bytes = new TextEncoder().encode(text).length;
    return bytes ? deflateRawSize(text) / bytes : 0;
  };
  const preludeRatio = chunks.reduce((sum, chunk) => sum + ratio(chunk), 0) / chunks.length;
  // Positive values mean the sample compresses better after AI-written text,
  // which ZipPy reads as AI-like. ZipPy scores 1,500-character chunks and
  // weights them by length; social posts are usually a single chunk.
  return function score(text) {
    const contents = zippyCleanText(text);
    if (!contents.trim()) return null;
    const pieces = [];
    let start = 0;
    while (start + 1500 < contents.length) {
      const end = contents.lastIndexOf(' ', start + 1500);
      if (end <= start) break;
      pieces.push(contents.slice(start, end));
      start = end;
    }
    pieces.push(contents.slice(start));
    let total = 0;
    for (const piece of pieces) {
      const sampleRatio = chunks.reduce((sum, chunk) => sum + ratio(chunk + piece), 0) / chunks.length;
      total += (preludeRatio - sampleRatio) * (piece.length / contents.length);
    }
    return total;
  };
}

// Biber-style grammatical rates (Reinhart et al., PNAS 2025) approximated
// without a part-of-speech tagger. These are regex stand-ins: clause-initial
// -ing participles, -tion/-ment/-ness/-ity nominalizations and be + participle
// passives without "by". Phrasal coordination needs real tags and is omitted.
const NON_VERB_ING = new Set(['thing', 'things', 'nothing', 'something', 'anything', 'everything', 'morning', 'evening',
  'during', 'king', 'kings', 'ring', 'rings', 'string', 'strings', 'spring', 'wing', 'wings', 'ceiling', 'sibling',
  'bring', 'sing', 'swing', 'sting', 'darling', 'pudding', 'wedding', 'shilling', 'herring', 'awning']);
const IRREGULAR_PARTICIPLES = 'done|made|given|taken|seen|known|shown|written|built|found|held|kept|left|lost|paid|sold|sent|told|thought|brought|caught|taught|put|set|cut|read|run|born|chosen|driven|eaten|fallen|forgotten|hidden|spoken|stolen|worn';
const PASSIVE = new RegExp('\\b(?:is|are|was|were|be|been|being)\\s+(?:[a-z]+ly\\s+)?(?:[a-z]+ed|' + IRREGULAR_PARTICIPLES + ')\\b(?!\\s+by\\b)', 'gi');
const PARTICIPLE_CLAUSE = /(?:^|[.!?]\s+|[,;:—–]\s*)([A-Za-z]+ing)\b/gm;
const NOMINALIZATION = /^[a-z]{4,}(?:tions?|ments?|ness(?:es)?|ity|ities)$/;

function words(text) {
  return (String(text || '').toLowerCase().replace(/[‘’]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) || []);
}

export function grammaticalRates(text) {
  const tokens = words(text);
  const per100 = (count) => tokens.length ? count * 100 / tokens.length : 0;
  const participles = Array.from(String(text || '').matchAll(PARTICIPLE_CLAUSE), (match) => match[1].toLowerCase())
    .filter((word) => !NON_VERB_ING.has(word)).length;
  return {
    participialClausesPer100: per100(participles),
    nominalizationsPer100: per100(tokens.filter((token) => NOMINALIZATION.test(token)).length),
    agentlessPassivesPer100: per100((String(text || '').match(PASSIVE) || []).length)
  };
}

// slop-score lists (https://github.com/sam-paech/slop-score, MIT, Copyright
// (c) 2025 Sam Paech), filtered to dictionary words. Trigrams are matched over
// tokens with stopwords removed, as the lists were built that way.
const SLOP_STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'as',
  'at', 'from', 'that', 'this', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'he', 'she', 'his', 'her', 'they',
  'them', 'their', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'not', 'no', 'so', 'than', 'then', 'there', 'into',
  'up', 'out', 'down', 'over', 'just', 'like', 'had', 'has', 'have', 'do', 'did', 'does', 'will', 'would', "couldn't", "didn't", "can't"]);

export function createSlopScorer({ slopWords, slopTrigrams }) {
  const wordSet = new Set(slopWords);
  const trigramSet = new Set(slopTrigrams);
  return function score(text) {
    const tokens = words(text);
    const per100 = (count) => tokens.length ? count * 100 / tokens.length : 0;
    const content = tokens.filter((token) => !SLOP_STOPWORDS.has(token)).map((token) => token.replace(/'.*$/, ''));
    let trigrams = 0;
    for (let index = 0; index + 2 < content.length; index += 1) {
      if (trigramSet.has(content[index] + ' ' + content[index + 1] + ' ' + content[index + 2])) trigrams += 1;
    }
    return {
      slopWordsPer100: per100(tokens.filter((token) => wordSet.has(token)).length),
      slopTrigramsPer100: per100(trigrams)
    };
  };
}

export function createResearchSignals({ seedText, deflateRawSize, slopWords, slopTrigrams }) {
  const zippy = createZippyScorer({ seedText, deflateRawSize });
  const slop = createSlopScorer({ slopWords, slopTrigrams });
  return function signals(text) {
    return { zippyDelta: zippy(text), ...grammaticalRates(text), ...slop(text) };
  };
}
