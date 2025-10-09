import re
from typing import Dict, List, Tuple

# 常见 OCR 误识匹配修正映射（保守策略，避免过度纠正）
_CORRECTIONS: List[Tuple[str, str]] = [
    (r"\bPlant-?8ased\b", "Plant-Based"),
    (r"\b8ased\b", "Based"),
    (r"\bTMHUNE\b", "IMMUNE"),
    (r"\bDONE\b", "BONE"),
    (r"(?i)gluten[-\s]*free\s*non[-\s]*gmo", "Gluten-Free Non-GMO"),
    (r"(?i)non[-\s]*gmo", "Non-GMO"),
    (r"(?i)for[\.|·\s]+sensitiy", "For Sensitivity"),
    (r"(?i)cardiometa", "Cardiometabolic"),
]


def _fix_numbers_units(text: str) -> str:
    """Standardise numeric-unit formatting for more consistent output."""

    cleaned = re.sub(r"(?<=\d)CD(?=\d)", "MCG", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"(?<=\d)U(?=\d)", " IU ", cleaned)

    # Normalise unit casing
    cleaned = re.sub(r"(?i)mcg", "MCG", cleaned)
    cleaned = re.sub(r"(?i)mg", "MG", cleaned)
    cleaned = re.sub(r"(?i)iu", "IU", cleaned)

    # Insert spacing between digits and letters, and around plus signs
    cleaned = re.sub(r"(\d)([A-Za-z])", r"\1 \2", cleaned)
    cleaned = re.sub(r"([A-Za-z])(\d)", r"\1 \2", cleaned)
    cleaned = re.sub(r"\s*\+\s*", " + ", cleaned)

    # Collapse duplicated whitespace
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def clean_word(text: str) -> str:
    """Apply targeted spelling corrections and unit normalisation."""

    cleaned = text
    for pattern, replacement in _CORRECTIONS:
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r"(?i)([a-z])\.(?=[a-z])", r"\1 ", cleaned)
    cleaned = cleaned.replace("·", " ")

    # Split concatenated words like "FreeNon" → "Free Non"
    cleaned = re.sub(r"([a-z])([A-Z])", r"\1 \2", cleaned)

    return _fix_numbers_units(cleaned)


def clean_text(lines: List[str]) -> List[str]:
    """Clean a list of text lines and drop very short noise tokens."""

    cleaned_lines: List[str] = []
    for line in lines:
        fixed = clean_word(line)
        if len(fixed.strip()) <= 2 and not re.search(r"\d", fixed):
            continue
        cleaned_lines.append(fixed)
    return cleaned_lines


def apply_post_corrections(
    words: List[Dict[str, object]],
    joined_text: str,
) -> Tuple[int, List[Dict[str, object]], str]:
    """Return the corrections count, updated words, and cleaned text."""

    corrected = 0
    for word in words:
        original = word.get("text", "") or ""
        fixed = clean_word(str(original))
        if fixed != original:
            corrected += 1
            word["text"] = fixed

    lines = joined_text.splitlines()
    cleaned_lines = clean_text(lines)

    return corrected, words, "\n".join(cleaned_lines)
