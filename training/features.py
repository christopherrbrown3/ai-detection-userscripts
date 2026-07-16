from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple


CHAR_HASH_DIM = 128

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "because", "so", "of", "to", "in", "on",
    "for", "with", "by", "as", "at", "from", "that", "this", "these", "those", "is", "are", "was",
    "were", "be", "been", "being", "it", "its", "they", "them", "their", "we", "our", "you", "your",
    "i", "me", "my", "he", "his", "she", "her", "not", "no", "yes", "do", "does", "did", "can",
    "could", "would", "should", "may", "might", "must", "will", "just", "have", "has", "had",
}

FIRST_PERSON = {"i", "me", "my", "mine", "we", "us", "our", "ours"}
SECOND_PERSON = {"you", "your", "yours", "yourself", "yourselves"}

PHRASES = {
    "buzz": [
        "synergy", "leverage", "unlock", "paradigm", "disrupt", "innovative", "thought leadership",
        "game-changer", "empower", "elevate", "journey", "mission", "vision", "stakeholders",
        "scalable", "robust", "strategic", "amazing", "incredible", "excited to announce",
        "thrilled to", "grateful for", "honored to", "humble", "delighted to share", "proud to",
    ],
    "hedge": [
        "as an ai", "as a language model", "i cannot", "i'm unable", "i am unable",
        "i don't have access", "cannot provide", "i cannot provide",
    ],
    "transition": [
        "in conclusion", "overall", "to sum up", "moreover", "furthermore", "additionally",
        "in addition", "on the other hand", "as a result", "in summary", "it is important to",
        "it is worth noting", "at the end of the day", "in the meantime", "that said",
        "in other words", "to be clear", "to put it simply", "as such", "with that in mind",
    ],
    "template": [
        "here's the thing", "let's dive in", "key takeaways", "tldr", "tl;dr", "in today's world",
        "i want to share", "i'm excited to share", "if you're", "what i learned", "lessons learned",
        "actionable steps", "in this post", "in this thread", "here are", "here's how", "here is how",
        "step by step",
    ],
}

TOKEN_RE = re.compile(r"[^\W_]+(?:['’][^\W_]+)?", flags=re.UNICODE)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def sigmoid(value: float) -> float:
    if value >= 20:
        return 1.0
    if value <= -20:
        return 0.0
    return 1.0 / (1.0 + math.exp(-value))


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", str(text or ""))
    normalized = re.sub(r"[\u200B-\u200D\uFEFF]", "", normalized)
    return normalized.replace("\u00a0", " ").replace("\r", "").strip()


def normalize_apostrophes(text: str) -> str:
    return str(text or "").replace("‘", "'").replace("’", "'")


def tokenize(text: str) -> List[str]:
    return [match.lower() for match in TOKEN_RE.findall(normalize_apostrophes(text))]


def mean(values: Iterable[float]) -> float:
    materialized = list(values)
    return sum(materialized) / len(materialized) if materialized else 0.0


def coefficient_of_variation(values: Iterable[float]) -> float:
    materialized = list(values)
    if not materialized:
        return 0.0
    average = mean(materialized)
    if not average:
        return 0.0
    variance = mean((value - average) ** 2 for value in materialized)
    return math.sqrt(variance) / average


def moving_average_type_token_ratio(tokens: List[str], window_size: int = 25) -> float:
    if not tokens:
        return 0.0
    size = min(window_size, len(tokens))
    if len(tokens) <= size:
        return len(set(tokens)) / len(tokens)
    windows = [len(set(tokens[index:index + size])) / size for index in range(len(tokens) - size + 1)]
    return mean(windows)


def repeated_ngram_ratio(tokens: List[str], size: int) -> float:
    if len(tokens) < size:
        return 0.0
    ngrams = [" ".join(tokens[index:index + size]) for index in range(len(tokens) - size + 1)]
    return 1.0 - len(set(ngrams)) / len(ngrams)


def utf16_units(text: str) -> List[int]:
    raw = text.encode("utf-16-le", errors="surrogatepass")
    return [raw[index] | (raw[index + 1] << 8) for index in range(0, len(raw), 2)]


def character_trigram_repeat_ratio(text: str) -> float:
    normalized = re.sub(r"\s+", " ", normalize_text(text).lower())
    units = utf16_units(normalized)
    if len(units) < 3:
        return 0.0
    grams = [tuple(units[index:index + 3]) for index in range(len(units) - 2)]
    return 1.0 - len(set(grams)) / len(grams)


def count_phrase_hits(text: str, phrases: Iterable[str]) -> int:
    normalized = normalize_apostrophes(text).lower()
    total = 0
    for phrase in phrases:
        pattern = rf"(^|[^a-z0-9]){re.escape(phrase)}(?=$|[^a-z0-9])"
        total += len(re.findall(pattern, normalized))
    return total


def fnv1a_units(units: Iterable[int]) -> int:
    value = 2166136261
    for unit in units:
        value ^= unit
        value = (value * 16777619) & 0xFFFFFFFF
    return value


def hashed_character_ngrams(text: str, dimension: int = CHAR_HASH_DIM) -> List[float]:
    normalized = normalize_apostrophes(text).lower()
    normalized = re.sub(r"[0-9]", "0", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    units = utf16_units(normalized)
    vector = [0.0] * dimension
    for size in range(3, 6):
        for index in range(max(0, len(units) - size + 1)):
            hashed = fnv1a_units(units[index:index + size])
            bucket = hashed % dimension
            sign = 1.0 if (hashed & 0x40000000) == 0 else -1.0
            vector[bucket] += sign
    norm = math.sqrt(sum(value * value for value in vector))
    return [value / norm for value in vector] if norm else vector


@dataclass(frozen=True)
class Extracted:
    features: Dict[str, float]
    metrics: Dict[str, float]
    char_ngrams: List[float]


def extract_features(text: str, *, kind: str) -> Extracted:
    raw = normalize_text(text)
    cleaned = re.sub(r"\s+", " ", raw)
    tokens = tokenize(cleaned)
    word_count = len(tokens)
    char_count = len(utf16_units(cleaned))

    sentence_texts = [value.strip() for value in re.split(r"[.!?]+|\n+", cleaned) if value.strip()]
    sentence_lengths = [len(tokenize(sentence)) for sentence in sentence_texts]
    sentence_lengths = [length for length in sentence_lengths if length]
    sentence_count = max(1, len(sentence_lengths))
    avg_sentence_len = mean(sentence_lengths) or float(word_count)
    sentence_len_cv = coefficient_of_variation(sentence_lengths)
    short_sentence_ratio = (
        sum(1 for length in sentence_lengths if length <= 8) / len(sentence_lengths)
        if sentence_lengths else 0.0
    )

    paragraph_lengths = [len(tokenize(value)) for value in re.split(r"\n+", raw)]
    paragraph_lengths = [length for length in paragraph_lengths if length]
    paragraph_len_cv = coefficient_of_variation(paragraph_lengths)
    word_lengths = [len(token.replace("'", "").replace("’", "")) for token in tokens]
    word_lengths = [length for length in word_lengths if length]
    word_len_cv = coefficient_of_variation(word_lengths)

    frequencies: Dict[str, int] = {}
    for token in tokens:
        frequencies[token] = frequencies.get(token, 0) + 1
    unique_count = len(frequencies)
    hapax_count = sum(1 for count in frequencies.values() if count == 1)
    top_count = max(frequencies.values()) if frequencies else 0
    type_token_ratio = unique_count / word_count if word_count else 0.0
    hapax_ratio = hapax_count / word_count if word_count else 0.0
    top_word_share = top_count / word_count if word_count else 0.0
    mattr25 = moving_average_type_token_ratio(tokens, 25)

    sentence_starters = [" ".join(tokenize(sentence)[:2]) for sentence in sentence_texts]
    sentence_starters = [starter for starter in sentence_starters if starter]
    starter_repeat_ratio = (
        1.0 - len(set(sentence_starters)) / len(sentence_starters)
        if sentence_starters else 0.0
    )

    stop_hits = sum(1 for token in tokens if token in STOPWORDS)
    first_person_hits = sum(1 for token in tokens if token in FIRST_PERSON)
    second_person_hits = sum(1 for token in tokens if token in SECOND_PERSON)
    contraction_hits = sum(1 for token in tokens if "'" in token)
    number_hits = sum(1 for token in tokens if re.search(r"\d", token))
    stopword_ratio = stop_hits / word_count if word_count else 0.0

    buzz_hits = count_phrase_hits(cleaned, PHRASES["buzz"])
    hedge_hits = count_phrase_hits(cleaned, PHRASES["hedge"])
    transition_hits = count_phrase_hits(cleaned, PHRASES["transition"])
    template_hits = count_phrase_hits(cleaned, PHRASES["template"])

    punctuation_counts = {
        "comma": len(re.findall(r",", cleaned)),
        "colon": len(re.findall(r":", cleaned)),
        "semicolon": len(re.findall(r";", cleaned)),
        "exclamation": len(re.findall(r"!", cleaned)),
        "question": len(re.findall(r"\?", cleaned)),
        "ellipsis": len(re.findall(r"(?:\.\.\.|…)", cleaned)),
        "quote": len(re.findall(r"[\"'“”‘’]", cleaned)),
        "parenthesis": len(re.findall(r"[()]", cleaned)),
    }
    punctuation_variety = sum(1 for count in punctuation_counts.values() if count > 0) / 8.0

    lines = raw.split("\n")
    list_marker_count = sum(1 for line in lines if re.match(r"^\s*(?:•|-|\*|\d+[.)])\s+", line))
    newline_count = len(re.findall(r"\n", raw))
    url_count = len(re.findall(r"\bhttps?://\S+|\bwww\.\S+", cleaned, flags=re.I))
    mention_count = len(re.findall(r"@\w+|(?:^|\s)/?[ur]/[A-Za-z0-9_-]+", cleaned))
    hashtag_count = len(re.findall(r"#\w+", cleaned))

    proper_nounish = 0
    original_words = raw.split()
    for index in range(1, len(original_words)):
        word = re.sub(r"^[^A-Za-z]+|[^A-Za-z]+$", "", original_words[index])
        previous = original_words[index - 1]
        if re.match(r"^[A-Z][a-z]+", word) and not re.search(r"[.!?]$", previous):
            proper_nounish += 1

    letters = [character for character in raw if character.isalpha()]
    latin_letters = len(re.findall(r"[A-Za-z]", raw))
    latin_ratio = latin_letters / len(letters) if letters else 0.0

    def per100(count: float) -> float:
        return count * 100.0 / word_count if word_count else 0.0

    features = {
        "typeTokenRatio": clamp(type_token_ratio, 0, 1),
        "mattr25": clamp(mattr25, 0, 1),
        "sentenceLenCV": clamp(sentence_len_cv / 2, 0, 1),
        "avgSentenceLen": clamp(avg_sentence_len / 40, 0, 1),
        "wordLenCV": clamp(word_len_cv, 0, 1),
        "paragraphLenCV": clamp(paragraph_len_cv / 2, 0, 1),
        "bigramRepeatRatio": clamp(repeated_ngram_ratio(tokens, 2), 0, 1),
        "trigramRepeatRatio": clamp(repeated_ngram_ratio(tokens, 3), 0, 1),
        "sentenceStarterRepeatRatio": clamp(starter_repeat_ratio, 0, 1),
        "charTrigramRepeatRatio": clamp(character_trigram_repeat_ratio(cleaned), 0, 1),
        "stopwordRatio": clamp(stopword_ratio, 0, 1),
        "hapaxRatio": clamp(hapax_ratio, 0, 1),
        "topWordShare": clamp(top_word_share, 0, 1),
        "contractionRatio": clamp(contraction_hits / word_count if word_count else 0, 0, 1),
        "firstPersonRatio": clamp(first_person_hits / word_count if word_count else 0, 0, 1),
        "secondPersonRatio": clamp(second_person_hits / word_count if word_count else 0, 0, 1),
        "shortSentenceRatio": clamp(short_sentence_ratio, 0, 1),
        "listMarkerCount": clamp(list_marker_count / 4, 0, 1),
        "newlineRatio": clamp((newline_count / max(1, len(utf16_units(raw)))) / 0.15, 0, 1),
        "discoursePer100w": clamp(per100(transition_hits) / 10, 0, 1),
        "templatePer100w": clamp(per100(template_hits) / 6, 0, 1),
        "buzzPer100w": clamp(per100(buzz_hits) / 6, 0, 1),
        "aiHedgePresent": 1.0 if hedge_hits > 0 else 0.0,
        "commaPer100w": clamp(per100(punctuation_counts["comma"]) / 30, 0, 1),
        "colonPer100w": clamp(per100(punctuation_counts["colon"]) / 10, 0, 1),
        "semicolonPer100w": clamp(per100(punctuation_counts["semicolon"]) / 6, 0, 1),
        "exclamationsPer100w": clamp(per100(punctuation_counts["exclamation"]) / 6, 0, 1),
        "questionsPer100w": clamp(per100(punctuation_counts["question"]) / 6, 0, 1),
        "ellipsisPer100w": clamp(per100(punctuation_counts["ellipsis"]) / 4, 0, 1),
        "quoteRatio": clamp((punctuation_counts["quote"] / max(1, char_count)) / 0.08, 0, 1),
        "parenRatio": clamp((punctuation_counts["parenthesis"] / max(1, char_count)) / 0.08, 0, 1),
        "punctuationVariety": clamp(punctuation_variety, 0, 1),
        "emojiPresent": 1.0 if re.search(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", cleaned) else 0.0,
    }

    metrics = {
        "wordCount": float(word_count),
        "charCount": float(char_count),
        "sentenceCount": float(sentence_count),
        "avgSentenceLen": float(avg_sentence_len),
        "sentenceLenCV": float(sentence_len_cv),
        "wordLenCV": float(word_len_cv),
        "paragraphLenCV": float(paragraph_len_cv),
        "typeTokenRatio": float(type_token_ratio),
        "mattr25": float(mattr25),
        "hapaxRatio": float(hapax_ratio),
        "stopwordRatio": float(stopword_ratio),
        "bigramRepeatRatio": float(repeated_ngram_ratio(tokens, 2)),
        "trigramRepeatRatio": float(repeated_ngram_ratio(tokens, 3)),
        "charTrigramRepeatRatio": float(character_trigram_repeat_ratio(cleaned)),
        "sentenceStarterRepeatRatio": float(starter_repeat_ratio),
        "topWordShare": float(top_word_share),
        "listMarkerCount": float(list_marker_count),
        "urlCount": float(url_count),
        "mentionCount": float(mention_count),
        "hashtagCount": float(hashtag_count),
        "numberTokenRatio": float(number_hits / word_count if word_count else 0),
        "properNounishRatio": float(proper_nounish / word_count if word_count else 0),
        "latinRatio": float(latin_ratio),
        "isReply": 1.0 if kind == "comment" else 0.0,
    }
    return Extracted(
        features=features,
        metrics=metrics,
        char_ngrams=hashed_character_ngrams(cleaned, CHAR_HASH_DIM),
    )


def score_with_model(
    features: Dict[str, float],
    *,
    intercept: float,
    weights: Dict[str, float],
    char_ngrams: List[float] | None = None,
    char_ngram_weights: List[float] | None = None,
    calibration: Dict[str, float] | None = None,
) -> Tuple[float, float]:
    logit = float(intercept)
    for key, coefficient in weights.items():
        logit += float(coefficient) * float(features.get(key, 0.0))
    if char_ngrams and char_ngram_weights:
        logit += sum(value * weight for value, weight in zip(char_ngrams, char_ngram_weights))
    if calibration:
        return logit, sigmoid(float(calibration["slope"]) * logit + float(calibration["intercept"]))
    return logit, sigmoid(logit)
