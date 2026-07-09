from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Dict, Tuple


STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "because", "so", "of", "to", "in", "on",
    "for", "with", "by", "as", "at", "from", "that", "this", "these", "those", "is", "are", "was",
    "were", "be", "been", "being", "it", "its", "they", "them", "their", "we", "our", "you", "your",
    "i", "me", "my", "he", "his", "she", "her", "not", "no", "yes", "do", "does", "did", "can",
    "could", "would", "should", "may", "might", "must", "will", "just",
}

AI_BUZZ = [
    "synergy", "leverage", "unlock", "paradigm", "disrupt", "innovative", "thought leadership",
    "game-changer", "empower", "elevate", "journey", "mission", "vision", "stakeholders",
    "scalable", "robust", "strategic", "amazing", "incredible", "excited to announce",
    "thrilled to", "grateful for", "honored to", "humble", "delighted to share", "proud to",
]

HEDGE = [
    "as an ai", "as a language model", "i cannot", "i’m unable", "i am unable", "i don’t have access",
    "cannot provide", "i cannot provide",
]

TRANSITIONS = [
    "in conclusion", "overall", "to sum up", "moreover", "furthermore", "additionally", "in addition",
    "on the other hand", "as a result", "in summary", "it is important to", "it is worth noting",
    "at the end of the day", "in the meantime", "that said", "in other words", "to be clear",
    "to put it simply", "as such", "with that in mind",
]

GENERIC_TEMPLATES = [
    "here’s the thing", "here's the thing", "let’s dive in", "let's dive in",
    "key takeaways", "tldr", "tl;dr", "in today’s world", "in today's world",
    "i want to share", "i’m excited to share", "i'm excited to share",
    "if you’re", "if you're", "what i learned", "lessons learned", "actionable steps",
    "in this post", "here are", "here's how", "here is how",
]


def clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def strip_token(tok: str) -> str:
    return re.sub(r"^[^A-Za-z0-9]+|[^A-Za-z0-9']+$", "", tok or "")


def clean_for_tokens(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def normalize_text(text: str) -> str:
    return (text or "").replace("\u00A0", " ").replace("\r", "").strip()


def _count_hits(lower: str, phrases) -> int:
    return sum(1 for ph in phrases if ph in lower)


def _sigmoid(x: float) -> float:
    if x >= 20:
        return 1.0
    if x <= -20:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


@dataclass(frozen=True)
class Extracted:
    features: Dict[str, float]
    metrics: Dict[str, float]


def extract_features(text: str, *, kind: str) -> Extracted:
    raw = normalize_text(text)
    cleaned = clean_for_tokens(raw)
    lower = cleaned.lower()

    raw_words = cleaned.split() if cleaned else []
    tokens = [strip_token(w) for w in raw_words]
    tokens = [t for t in tokens if t]
    norm_tokens = [t.lower() for t in tokens if re.search(r"[a-z0-9]", t.lower())]

    word_count = len(norm_tokens)
    char_count = len(cleaned)

    # List / line structure (for platforms with multi-line posts).
    lines = (text or "").replace("\r", "").split("\n")
    list_marker_count = 0
    for ln in lines:
        ln = (ln or "").lstrip()
        if not ln:
            continue
        if re.match(r"^(\u2022|-|\*|\d+[\.\)])\s+", ln):
            list_marker_count += 1

    newline_count = len(re.findall(r"\n", text or ""))
    newline_ratio = newline_count / max(1, len(text or ""))

    sentences = [s.strip() for s in re.split(r"[.!?]+", cleaned) if s.strip()]
    sentence_lens = []
    for s in sentences:
        ws = [strip_token(w) for w in s.split()]
        ws = [w for w in ws if w]
        if ws:
            sentence_lens.append(len(ws))
    sentence_count = max(1, len(sentence_lens) or len(sentences) or 1)
    sent_mean = (sum(sentence_lens) / len(sentence_lens)) if sentence_lens else 0.0
    sent_var = (sum((x - sent_mean) ** 2 for x in sentence_lens) / len(sentence_lens)) if sentence_lens else 0.0
    sent_std = math.sqrt(sent_var)
    sentence_len_cv = (sent_std / sent_mean) if sent_mean else 0.0
    avg_sentence_len = sent_mean or ((word_count / sentence_count) if word_count else 0.0)

    uniq = set(norm_tokens)
    type_token_ratio = (len(uniq) / word_count) if word_count else 0.0

    freq: Dict[str, int] = {}
    for w in norm_tokens:
        freq[w] = freq.get(w, 0) + 1
    hapax_count = sum(1 for c in freq.values() if c == 1)
    top1 = max(freq.values()) if freq else 0
    hapax_ratio = (hapax_count / word_count) if word_count else 0.0
    top_word_share = (top1 / word_count) if word_count else 0.0

    bigrams = [f"{norm_tokens[i]} {norm_tokens[i+1]}" for i in range(max(0, word_count - 1))]
    bigram_repeat_ratio = 0.0
    if bigrams:
        bigram_repeat_ratio = 1.0 - (len(set(bigrams)) / len(bigrams))

    trigrams = [f"{norm_tokens[i]} {norm_tokens[i+1]} {norm_tokens[i+2]}" for i in range(max(0, word_count - 2))]
    trigram_repeat_ratio = 0.0
    if trigrams:
        trigram_repeat_ratio = 1.0 - (len(set(trigrams)) / len(trigrams))

    starters = []
    for s in sentences:
        ws = [strip_token(w) for w in s.split()]
        ws = [w for w in ws if w]
        if len(ws) >= 2:
            starters.append(f"{ws[0].lower()} {ws[1].lower()}")
    starter_repeat_ratio = 0.0
    if starters:
        starter_repeat_ratio = 1.0 - (len(set(starters)) / len(starters))

    stop_hits = sum(1 for w in norm_tokens if w in STOPWORDS)
    number_hits = sum(1 for w in norm_tokens if re.search(r"\d", w))
    stopword_ratio = (stop_hits / word_count) if word_count else 0.0
    number_token_ratio = (number_hits / word_count) if word_count else 0.0

    word_lens = [len(t) for t in tokens if t]
    avg_word_len = (sum(word_lens) / len(word_lens)) if word_lens else 0.0
    wl_mean = avg_word_len
    wl_var = (sum((x - wl_mean) ** 2 for x in word_lens) / len(word_lens)) if word_lens else 0.0
    wl_std = math.sqrt(wl_var)
    word_len_cv = (wl_std / wl_mean) if wl_mean else 0.0

    buzz_hits = _count_hits(lower, AI_BUZZ)
    hedge_hits = _count_hits(lower, HEDGE)
    transition_hits = _count_hits(lower, TRANSITIONS)
    template_hits = _count_hits(lower, GENERIC_TEMPLATES)

    exclamations = len(re.findall(r"!", cleaned))
    questions = len(re.findall(r"\?", cleaned))
    commas = len(re.findall(r",", cleaned))
    colons = len(re.findall(r":", cleaned))
    semicolons = len(re.findall(r";", cleaned))
    ellipsis_count = len(re.findall(r"(\.\.\.|…)", cleaned))
    quote_count = len(re.findall(r"[\"'“”‘’]", cleaned))
    paren_count = len(re.findall(r"[()]", cleaned))

    emoji_present = 1.0 if re.search(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", cleaned) else 0.0

    def per100(count: float) -> float:
        return (count / word_count) * 100.0 if word_count else 0.0

    url_count = len(re.findall(r"\bhttps?://\S+|\bwww\.\S+", cleaned, flags=re.I))
    mention_count = len(re.findall(r"@\w+", cleaned))
    hashtag_count = len(re.findall(r"#\w+", cleaned))

    proper_nounish = 0
    original_words = re.split(r"\s+", text or "")
    original_words = [w for w in original_words if w]
    for i in range(1, len(original_words)):
        w = re.sub(r"^[^A-Za-z]+|[^A-Za-z]+$", "", original_words[i])
        if not w:
            continue
        if not re.match(r"^[A-Z][a-z]+", w):
            continue
        prev = original_words[i - 1] or ""
        if re.search(r"[.!?]$", prev):
            continue
        proper_nounish += 1
    proper_nounish_ratio = (proper_nounish / word_count) if word_count else 0.0

    is_reply = 1.0 if kind == "comment" else 0.0

    # Feature scaling must match the userscripts.
    features = {
        "typeTokenRatio": clamp(type_token_ratio, 0, 1),
        "sentenceLenCV": clamp(sentence_len_cv / 2, 0, 1),
        "avgSentenceLen": clamp(avg_sentence_len / 40, 0, 1),
        "bigramRepeatRatio": clamp(bigram_repeat_ratio, 0, 1),
        "trigramRepeatRatio": clamp(trigram_repeat_ratio, 0, 1),
        "sentenceStarterRepeatRatio": clamp(starter_repeat_ratio, 0, 1),
        "stopwordRatio": clamp(stopword_ratio, 0, 1),
        "hapaxRatio": clamp(hapax_ratio, 0, 1),
        "topWordShare": clamp(top_word_share, 0, 1),
        "listMarkerCount": clamp(list_marker_count / 4, 0, 1),
        "newlineRatio": clamp(newline_ratio / 0.15, 0, 1),
        "discoursePer100w": clamp(per100(transition_hits) / 10, 0, 1),
        "templatePer100w": clamp(per100(template_hits) / 6, 0, 1),
        "buzzPer100w": clamp(per100(buzz_hits) / 6, 0, 1),
        "aiHedgePresent": 1.0 if hedge_hits > 0 else 0.0,
        "commaPer100w": clamp(per100(commas) / 30, 0, 1),
        "colonPer100w": clamp(per100(colons) / 10, 0, 1),
        "semicolonPer100w": clamp(per100(semicolons) / 6, 0, 1),
        "exclamationsPer100w": clamp(per100(exclamations) / 6, 0, 1),
        "questionsPer100w": clamp(per100(questions) / 6, 0, 1),
        "ellipsisPer100w": clamp(per100(ellipsis_count) / 4, 0, 1),
        "quoteRatio": clamp(((quote_count / max(1, char_count)) / 0.08), 0, 1),
        "parenRatio": clamp(((paren_count / max(1, char_count)) / 0.08), 0, 1),
        "emojiPresent": emoji_present,
    }

    metrics = {
        "wordCount": float(word_count),
        "charCount": float(char_count),
        "sentenceCount": float(sentence_count),
        "avgSentenceLen": float(avg_sentence_len),
        "sentenceLenCV": float(sentence_len_cv),
        "typeTokenRatio": float(type_token_ratio),
        "hapaxRatio": float(hapax_ratio),
        "avgWordLen": float(avg_word_len),
        "wordLenCV": float(word_len_cv),
        "stopwordRatio": float(stopword_ratio),
        "bigramRepeatRatio": float(bigram_repeat_ratio),
        "trigramRepeatRatio": float(trigram_repeat_ratio),
        "sentenceStarterRepeatRatio": float(starter_repeat_ratio),
        "topWordShare": float(top_word_share),
        "newlineRatio": float(newline_ratio),
        "listMarkerCount": float(list_marker_count),
        "buzzHits": float(buzz_hits),
        "hedgeHits": float(hedge_hits),
        "transitionHits": float(transition_hits),
        "templateHits": float(template_hits),
        "exclamations": float(exclamations),
        "questions": float(questions),
        "commas": float(commas),
        "colons": float(colons),
        "semicolons": float(semicolons),
        "ellipsisCount": float(ellipsis_count),
        "quoteRatio": float(quote_count / max(1, char_count)),
        "parenRatio": float(paren_count / max(1, char_count)),
        "urlCount": float(url_count),
        "mentionCount": float(mention_count),
        "hashtagCount": float(hashtag_count),
        "numberTokenRatio": float(number_token_ratio),
        "properNounishRatio": float(proper_nounish_ratio),
        "isReply": is_reply,
    }

    return Extracted(features=features, metrics=metrics)


def score_with_model(features: Dict[str, float], *, intercept: float, weights: Dict[str, float]) -> Tuple[float, float]:
    logit = float(intercept)
    for k, coef in weights.items():
        logit += float(coef) * float(features.get(k, 0.0))
    return logit, _sigmoid(logit)
