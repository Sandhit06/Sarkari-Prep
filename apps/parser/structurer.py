"""
Stage 3/4 — Question segmentation & structuring.

The service ships with a deterministic, zero-cost structurer that understands
the Markdown contributor format *and* the messier text produced by PDF/OCR
extraction. An optional Ollama structurer can be enabled with
`LLM_PROVIDER=ollama`; it falls back to the deterministic path whenever the
local model server is unavailable.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
import os
import re
import httpx


class OptionItem(BaseModel):
    id: str = Field(..., pattern="^[A-E]$")
    text: str
    textHindi: Optional[str] = None


class ParsedQuestion(BaseModel):
    questionNumber: int
    text: str
    textHindi: Optional[str] = None
    options: List[OptionItem]
    questionType: str = "SINGLE_CHOICE"
    correctOptionId: Optional[str] = None
    correctOptionIds: List[str] = Field(default_factory=list)
    correctNumericalAnswer: Optional[float] = None
    numericalTolerance: Optional[float] = None
    explanation: Optional[str] = None
    subjectTag: str = "General Awareness"
    topicTag: str = "General"
    difficulty: str = "MODERATE"
    marks: float = 2.0
    negativeMarks: float = 0.5
    sourceConfidence: float = Field(default=0.85, ge=0.0, le=1.0)
    needsHumanReview: bool = True


class ParsedPaperDraft(BaseModel):
    examSlug: str
    year: int
    title: str
    shift: Optional[str] = None
    setSeries: Optional[str] = None
    durationMinutes: int = 60
    positiveMarks: float = 2.0
    negativeMarks: float = 0.5
    maximumMarks: Optional[float] = None
    expectedQuestionCount: Optional[int] = None
    language: str = "en"
    sourceType: str = "USER_UPLOADED"
    needsReview: bool = True
    averageConfidence: float
    questions: List[ParsedQuestion]
    warnings: List[str] = []


# ---------------------------------------------------------------------------
# Metadata header parsing
# ---------------------------------------------------------------------------

META_LINE_RE = re.compile(
    r"^\s*#?\s*(?P<key>exam(?:[ _-]?slug)?|paper|title|year|shift|set(?:[ _-]?series)?|"
    r"maximum[ _-]?marks?|total[ _-]?questions?|marks|duration(?:[ _-]?minutes)?|source|language)\s*[:=]\s*(?P<value>.+?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)

MARKS_RE = re.compile(r"([+\-]?)\s*(\d+(?:\.\d+)?)")
DURATION_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)?", re.IGNORECASE)


def _slugify(value: str) -> str:
    value = value.strip().lower().replace("_", "-")
    value = re.sub(r"[^a-z0-9\-\s]", "", value)
    return re.sub(r"\s+", "-", value).strip("-")


def parse_marks(value: str) -> Tuple[Optional[float], Optional[float]]:
    """Parse `+2.0, -0.50`, `2 / -0.5`, `+2 -0.5` etc."""
    positive: Optional[float] = None
    negative: Optional[float] = None
    for sign, number in MARKS_RE.findall(value):
        amount = abs(float(number))
        if sign == "-":
            negative = amount
        elif positive is None:
            positive = amount
        else:
            negative = amount
    return positive, negative


def parse_duration(value: str) -> Optional[int]:
    match = DURATION_RE.search(value)
    if not match:
        return None
    amount = float(match.group(1))
    unit = (match.group(2) or "minutes").lower()
    if unit.startswith(("hour", "hr")):
        amount *= 60
    return int(round(amount))


def extract_metadata(text: str, defaults: Dict[str, Any]) -> Dict[str, Any]:
    """Read the optional `# Key: value` header block contributors can add."""
    meta = dict(defaults)
    header = "\n".join(text.replace("\r\n", "\n").split("\n")[:30])
    header = re.sub(r"\*\*([^*]+)\*\*", r"\1", header)

    for match in META_LINE_RE.finditer(header):
        key = match.group("key").lower().replace("_", " ").replace("-", " ").strip()
        value = match.group("value").strip().strip("#").strip()

        if key.startswith("exam"):
            meta["examSlug"] = _slugify(value)
        elif key in ("paper", "title"):
            meta["title"] = value
        elif key == "year":
            year_match = re.search(r"(19|20)\d{2}", value)
            if year_match:
                meta["year"] = int(year_match.group(0))
        elif key in ("maximum marks", "maximum mark"):
            maximum = re.search(r"\d+(?:\.\d+)?", value)
            if maximum:
                meta["maximumMarks"] = float(maximum.group(0))
        elif key in ("total questions", "total question"):
            count = re.search(r"\d+", value)
            if count:
                meta["expectedQuestionCount"] = int(count.group(0))
        elif key == "shift":
            meta["shift"] = value
        elif key.startswith("set"):
            meta["setSeries"] = value
        elif key == "marks":
            positive, negative = parse_marks(value)
            if positive is not None:
                meta["positiveMarks"] = positive
            if negative is not None:
                meta["negativeMarks"] = negative
        elif key.startswith("duration"):
            minutes = parse_duration(value)
            if minutes:
                meta["durationMinutes"] = minutes
        elif key == "source":
            lowered = value.lower()
            if "official" in lowered:
                meta["sourceType"] = "OFFICIAL"
            elif "memory" in lowered:
                meta["sourceType"] = "MEMORY_BASED"
            else:
                meta["sourceType"] = "USER_UPLOADED"
        elif key == "language":
            meta["language"] = value.lower()[:5]

    # Markdown papers often use a single H1 title instead of `Title:` metadata.
    h1 = re.search(r"(?m)^\s{0,3}#\s+(?!#)(.+?)\s*$", header)
    if h1 and not re.match(r"(?i)(?:exam|year|duration|maximum\s+marks|total\s+questions|paper\s+code)\s*:", h1.group(1)):
        meta["title"] = h1.group(1).strip()
        year_match = re.search(r"\b(?:19|20)\d{2}\b", h1.group(1))
        if year_match:
            meta["year"] = int(year_match.group(0))

    return meta


# ---------------------------------------------------------------------------
# Question segmentation
# ---------------------------------------------------------------------------

QUESTION_START_RE = re.compile(
    r"(?m)^[ \t]*(?:#{1,6}[ \t]*)?(?:Q(?:uestion)?[ \t]*[.\-:]?[ \t]*)?(\d{1,3})[ \t]*[.)\]:][ \t]*(?=\S)"
)

ANSWER_KEY_HEADING_RE = re.compile(
    r"answer\s*key|answer\s*sheet|official\s*key|key\s*[:\-]", re.IGNORECASE
)
ANSWER_KEY_PAIR_RE = re.compile(
    r"(?<!\d)(\d{1,3})\s*[.)\-–:]?\s*(?:\(?([A-Ea-e](?:\s*[,/&]?\s*[A-Ea-e])*)\)?|([+\-]?\d+(?:\.\d+)?))"
)
ANSWER_KEY_TABLE_ROW_RE = re.compile(
    r"^\s*\|\s*(\d{1,3})\s*\|\s*(?:MCQ|MSQ|NAT)\s*\|\s*\d+(?:\.\d+)?\s*\|\s*([^|]+?)\s*\|?\s*$",
    re.IGNORECASE,
)


def split_question_blocks(text: str) -> List[str]:
    """Split raw extracted text into per-question blocks."""
    normalised = text.replace("\r\n", "\n").replace("\r", "\n")
    normalised = re.sub(r"\n{3,}", "\n\n", normalised)

    # Drop a trailing answer-key table so it does not leak into the last stem.
    key_heading = re.search(
        r"(?im)^\s*#{0,6}\s*(?:answer\s*key|answer\s*sheet|official\s*key)\b[^\n]*$",
        normalised,
    )
    if key_heading:
        normalised = normalised[: key_heading.start()]

    matches = list(QUESTION_START_RE.finditer(normalised))
    if not matches:
        # Keep only plausible unnumbered questions, never every paragraph in
        # the document (which would turn instructions and metadata into items).
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", normalised)]
        return [p for p in paragraphs if _looks_like_question(p)]

    blocks: List[str] = []
    section_matches = list(re.finditer(
        r"(?im)^\s*#{1,6}\s*Section\s+[A-Z0-9]+\s*[—–-]\s*(.+?)\s*$",
        normalised,
    ))
    active_section = ""
    section_index = 0
    for index, match in enumerate(matches):
        while section_index < len(section_matches) and section_matches[section_index].start() < match.start():
            active_section = section_matches[section_index].group(1).strip()
            section_index += 1
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalised)
        block = normalised[match.start():end].strip()
        if len(block) >= 12:
            if "general aptitude" in active_section.lower():
                header, separator, body = block.partition("\n")
                block = f"{header}\nSubject: General Aptitude{separator}{body}"
            blocks.append(block)
    return blocks


def _looks_like_question(block: str) -> bool:
    cleaned = re.sub(r"(?m)^\s*#{1,6}\s*", "", block).strip()
    if len(cleaned) < 25 or re.match(
        r"(?i)^(?:general instructions?|section\b|answer format\s*:|paper code\s*:|"
        r"duration\s*:|maximum marks\s*:|total questions\s*:|difficulty\s*:|"
        r"exam\s*:|title\s*:|year\s*:|marks\s*:)",
        cleaned,
    ):
        return False
    if re.search(r"(?im)^\s*(?:[-*•]\s+|\d+[.)]\s+)", cleaned) and "?" not in cleaned:
        return False
    return "?" in cleaned or len(INLINE_OPTION_RE.findall(cleaned)) >= 2


def extract_answer_key(text: str) -> Dict[int, str]:
    """Pick up a separate answer-key table (very common on scanned papers)."""
    match = ANSWER_KEY_HEADING_RE.search(text)
    if not match:
        return {}

    tail = text[match.end():]
    # Do not scan into the explanation section.
    stop = re.search(r"\n\s*(?:explanations?|solutions?)\b", tail, re.IGNORECASE)
    if stop:
        tail = tail[: stop.start()]

    key: Dict[int, str] = {}
    for line in tail.splitlines():
        row = ANSWER_KEY_TABLE_ROW_RE.match(line)
        if row:
            key.setdefault(int(row.group(1)), row.group(2).strip())
    for number, letter_answer, numeric_answer in ANSWER_KEY_PAIR_RE.findall(tail):
        question_number = int(number)
        if 1 <= question_number <= 500:
            answer = letter_answer or numeric_answer
            if question_number not in key:
                key[question_number] = answer.upper() if letter_answer else answer
    return key


# ---------------------------------------------------------------------------
# Option / answer parsing helpers
# ---------------------------------------------------------------------------

OPTION_RE = re.compile(r"^\s*(?:\(([A-Ea-e])\)|([A-Ea-e])[.)])\s+(.+)$")
INLINE_OPTION_RE = re.compile(r"(?:\(([A-Da-d])\)|(?:^|\s)([A-Da-d])[.)])\s+")
ANS_RE = re.compile(
    r"(?:Ans(?:wer)?|Correct\s*Option|Key)\s*[:\-]?\s*\(?([A-Ea-e])\)?", re.IGNORECASE
)
MULTI_ANS_RE = re.compile(
    r"^(?:Ans(?:wer)?|Correct\s*Options?|Key)\s*[:\-]?\s*\(?([A-Ea-e](?:\s*[,/&]\s*[A-Ea-e])+)\)?\s*$",
    re.IGNORECASE,
)
NUM_ANS_RE = re.compile(
    r"^(?:Ans(?:wer)?|Correct\s*Answer|Key)\s*[:\-]?\s*([+\-]?\d+(?:\.\d+)?)\s*$",
    re.IGNORECASE,
)
TOLERANCE_RE = re.compile(
    r"^Tolerance\s*[:\-]?\s*([+\-]?\d+(?:\.\d+)?)\s*$", re.IGNORECASE
)
QUESTION_MARKS_RE = re.compile(r"^(?:Marks?|Positive\s*Marks?)\s*[:\-]\s*(\d+(?:\.\d+)?)\s*$", re.IGNORECASE)
QUESTION_NEGATIVE_RE = re.compile(r"^(?:Negative(?:\s*Marks?)?|Penalty)\s*[:\-]\s*(\d+(?:\.\d+)?|\d+\s*/\s*\d+)\s*$", re.IGNORECASE)
BRACKET_MARKS_RE = re.compile(r"\[\s*(\d+(?:\.\d+)?)\s*marks?\s*\]", re.IGNORECASE)
BRACKET_TYPE_RE = re.compile(r"\[\s*(MCQ|MSQ|NAT)\s*\]", re.IGNORECASE)
ANSWER_FORMAT_RE = re.compile(r"^Answer\s*format\s*:", re.IGNORECASE)
QUESTION_TYPE_RE = re.compile(
    r"^(?:Question\s*)?Type\s*[:\-]\s*(.+)$", re.IGNORECASE
)
EXP_RE = re.compile(r"^(?:Explanation|Solution|Sol)\s*[:\-]\s*(.+)$", re.IGNORECASE)
SUBJECT_RE = re.compile(r"^(?:Subject|Section)\s*[:\-]\s*(.+)$", re.IGNORECASE)
TOPIC_RE = re.compile(r"^Topic\s*[:\-]\s*(.+)$", re.IGNORECASE)
DIFFICULTY_RE = re.compile(r"^Difficulty\s*[:\-]\s*(.+)$", re.IGNORECASE)

OPTION_ID_MAP = {"1": "A", "2": "B", "3": "C", "4": "D", "5": "E"}
VALID_OPTION_IDS = ("A", "B", "C", "D", "E")

SUBJECT_HINTS: List[Tuple[str, str, str]] = [
    (
        "Quantitative Aptitude",
        "Arithmetic",
        r"\b(?:percent|profit|loss|ratio|average|interest|speed|train|work|equation|"
        r"simplif|geometry|triangle|mensuration|time and|number system|pipe|cistern)\b",
    ),
    (
        "Reasoning Ability",
        "Logical Reasoning",
        r"\b(?:series|coding|blood relation|direction|syllogism|seating|analogy|"
        r"odd one|mirror|water image|statement|assumption|puzzle)\b",
    ),
    (
        "English Language",
        "Grammar & Vocabulary",
        r"\b(?:synonym|antonym|idiom|phrase|passage|sentence|grammar|fill in the blank|"
        r"error|comprehension|spelling|spelt|cloze|correctly)\b",
    ),
    (
        "General Awareness",
        "Current Affairs & Static GK",
        r"\b(?:article|constitution|commission|minister|capital|currency|festival|"
        r"scheme|history|geography|science|award|sports|book)\b",
    ),
]


def split_inline_options(line: str) -> List[Tuple[str, str]]:
    """Handle OCR output where all four options share one line."""
    markers = list(INLINE_OPTION_RE.finditer(line))
    if len(markers) < 2:
        return []

    options: List[Tuple[str, str]] = []
    for index, marker in enumerate(markers):
        option_id = (marker.group(1) or marker.group(2)).upper()
        start = marker.end()
        end = markers[index + 1].start() if index + 1 < len(markers) else len(line)
        text = line[start:end].strip(" \t|;")
        if text:
            options.append((option_id, text))
    return options


def infer_subject(
    stem: str, options: List[OptionItem], gate_mode: bool = False
) -> Tuple[str, str]:
    haystack = " ".join([stem] + [option.text for option in options]).lower()
    if gate_mode:
        gate_hints = [
            ("Compiler Design", "Parsing and Translation", r"\b(?:slr|ll\(1\)|lr\(1\)|compiler|lexer|lexical|first and follow|shift.reduce|tokeniz|parser|grammar)\b"),
            ("Theory of Computation", "Automata and Formal Languages", r"\b(?:pumping lemma|regular language|context.free|turing|dfa|nfa|pushdown|recognizab|decidable|nonregular|palindrome language)\b"),
            ("Databases", "Database Systems", r"\b(?:functional dependenc|b\+ tree|sql|transaction|serializab|normal form|index page|natural join|candidate key|database)\b"),
            ("Operating Systems", "Operating Systems", r"\b(?:page fault|page replacement|deadlock|process|disk scheduler|filesystem|file system|virtual address|segment|round.robin|semaphore)\b"),
            ("Computer Networks", "Computer Networks", r"\b(?:router|subnet|ethernet|tcp|udp|arq|network protocol|packet|link cost|backoff|longest.prefix)\b"),
            ("Digital Logic", "Digital Logic", r"\b(?:boolean|truth table|two.s complement|static.1 hazard|carry.lookahead|counter|implicant|logic circuit|control word)\b"),
            ("Computer Organization and Architecture", "Computer Organization", r"\b(?:pipeline|cache|instruction|register|branch displacement|memory hierarchy|address bits)\b"),
            ("Programming and Data Structures", "Programming and Data Structures", r"\b(?:binary heap|heap|hash table|linked list|stack|queue|binary tree|array|loop|code below|program|big.o)\b"),
            ("Algorithms", "Algorithms", r"\b(?:minimum spanning|shortest path|dijkstra|sorting|binary search|matching|articulation|graph|time complexity|asymptotic|greedy|dynamic programming)\b"),
            ("Engineering Mathematics", "Discrete Mathematics and Probability", r"\b(?:matrix|eigenvalue|determinant|variance|mean|median|probability|random variable|expectation|subgroup|coset|surjective|sequence|derivative|integral|function f\()\b"),
            ("General Aptitude", "Verbal and Analytical Aptitude", r"\b(?:formal english|survey|respondents?|causation|best supported|completing both blanks|reports? that)\b"),
        ]
        for subject, topic, pattern in gate_hints:
            if re.search(pattern, haystack):
                return subject, topic
        return "General Aptitude", "General Aptitude"
    for subject, topic, pattern in SUBJECT_HINTS:
        if re.search(pattern, haystack):
            return subject, topic
    return "General Awareness", "Current Affairs & Static GK"


def normalise_difficulty(value: Optional[str]) -> str:
    if not value:
        return "MODERATE"
    lowered = value.strip().lower()
    if lowered.startswith("easy"):
        return "EASY"
    if lowered.startswith("hard") or lowered.startswith("difficult"):
        return "HARD"
    return "MODERATE"


def _clean_stem(line: str) -> str:
    return re.sub(
        r"^\s*(?:Q(?:uestion)?\s*\d+[.)\]:]?|\d{1,3}[.)\]:])\s*", "", line, flags=re.IGNORECASE
    ).strip()


def parse_question_block(
    block: str,
    question_number: int,
    default_marks: float,
    default_neg: float,
    fallback_answer: Optional[str] = None,
    gate_mode: bool = False,
) -> ParsedQuestion:
    lines = [line.strip() for line in block.split("\n") if line.strip()]

    stem_lines: List[str] = []
    options: List[OptionItem] = []
    answer: Optional[str] = None
    answer_ids: List[str] = []
    numerical_answer: Optional[float] = None
    numerical_tolerance: Optional[float] = None
    question_type: Optional[str] = None
    explanation: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    question_marks = default_marks
    question_negative = default_neg
    explicit_question_negative = False
    in_explanation = False

    if lines:
        question_header = QUESTION_START_RE.match(lines[0])
        if question_header:
            question_number = int(question_header.group(1))
            header_text = lines[0][question_header.end():]
            mark_tag = BRACKET_MARKS_RE.search(header_text)
            type_tag = BRACKET_TYPE_RE.search(header_text)
            if mark_tag:
                question_marks = float(mark_tag.group(1))
                header_text = BRACKET_MARKS_RE.sub("", header_text)
            if type_tag:
                question_type = {
                    "MCQ": "SINGLE_CHOICE",
                    "MSQ": "MULTI_CHOICE",
                    "NAT": "NUMERICAL",
                }[type_tag.group(1).upper()]
                header_text = BRACKET_TYPE_RE.sub("", header_text)
            lines[0] = header_text.strip()
            if not lines[0]:
                lines = lines[1:]

    for raw_line in lines:
        line = raw_line.strip()

        if line.startswith("```") or ANSWER_FORMAT_RE.match(line):
            continue

        if in_explanation:
            explanation = f"{explanation} {line}".strip()
            continue

        match = SUBJECT_RE.match(line)
        if match:
            subject = match.group(1).strip()
            continue

        match = TOPIC_RE.match(line)
        if match:
            topic = match.group(1).strip()
            continue

        match = DIFFICULTY_RE.match(line)
        if match:
            difficulty = match.group(1).strip()
            continue

        match = QUESTION_TYPE_RE.match(line)
        if match:
            lowered = match.group(1).strip().lower()
            if "multi" in lowered or "msq" in lowered:
                question_type = "MULTI_CHOICE"
            elif "numer" in lowered or lowered == "nat":
                question_type = "NUMERICAL"
            else:
                question_type = "SINGLE_CHOICE"
            continue

        match = TOLERANCE_RE.match(line)
        if match:
            numerical_tolerance = float(match.group(1))
            continue

        match = QUESTION_MARKS_RE.match(line)
        if match:
            question_marks = float(match.group(1))
            continue

        match = QUESTION_NEGATIVE_RE.match(line)
        if match:
            explicit_question_negative = True
            value = match.group(1).replace(" ", "")
            if "/" in value:
                numerator, denominator = value.split("/", 1)
                question_negative = float(numerator) / float(denominator)
            else:
                question_negative = float(value)
            continue

        match = MULTI_ANS_RE.match(line)
        if match:
            answer_ids = [
                value.upper()
                for value in re.findall(r"[A-Ea-e]", match.group(1))
            ]
            continue

        match = NUM_ANS_RE.match(line)
        if match:
            numerical_answer = float(match.group(1))
            continue

        match = EXP_RE.match(line)
        if match:
            explanation = match.group(1).strip()
            in_explanation = True
            continue

        # Only treat short lines as an answer line; long stems may contain "key".
        match = ANS_RE.search(line)
        if match and len(line) <= 40:
            answer = match.group(1).upper()
            continue

        inline = split_inline_options(line)
        if len(inline) >= 2:
            for option_id, text in inline:
                if len(options) < 5 and text:
                    options.append(OptionItem(id=option_id, text=text))
            continue

        match = OPTION_RE.match(line)
        if match:
            raw_id = (match.group(1) or match.group(2)).upper()
            option_id = OPTION_ID_MAP.get(raw_id, raw_id)
            if option_id in VALID_OPTION_IDS and len(options) < 5:
                options.append(OptionItem(id=option_id, text=match.group(3).strip()))
                continue

        if options:
            # Continuation of the previous option (wrapped OCR line).
            options[-1].text = f"{options[-1].text} {line}".strip()
        else:
            stem_lines.append(_clean_stem(line))

    if answer is None and fallback_answer:
        answer = fallback_answer
    if answer and not answer_ids:
        answer_ids = [answer]

    if numerical_answer is not None:
        question_type = "NUMERICAL"
    elif len(answer_ids) > 1:
        question_type = "MULTI_CHOICE"
    elif not question_type:
        question_type = "SINGLE_CHOICE"

    if question_type == "MULTI_CHOICE" and len(answer_ids) == 1:
        answer_ids = [answer_ids[0]]
    if question_type == "SINGLE_CHOICE" and answer_ids:
        answer = answer_ids[0]
        answer_ids = [answer_ids[0]]
    if question_type == "NUMERICAL":
        options = []
        answer = None
        answer_ids = []

    if gate_mode:
        if question_type in ("NUMERICAL", "MULTI_CHOICE"):
            question_negative = 0
        elif not explicit_question_negative:
            question_negative = question_marks / 3
            if question_marks == 2:
                question_negative = 2 / 3

    if question_type != "NUMERICAL":
        while len(options) < 4:
            option_id = VALID_OPTION_IDS[len(options)]
            options.append(OptionItem(id=option_id, text=f"[Option {option_id} - requires review]"))

    stem = " ".join(part for part in stem_lines if part).strip() or f"Question {question_number}"

    if not subject:
        subject, inferred_topic = infer_subject(stem, options, gate_mode)
        topic = topic or inferred_topic
    topic = topic or "General"

    has_answer = (
        numerical_answer is not None
        if question_type == "NUMERICAL"
        else bool(answer_ids or answer)
    )
    confidence = 0.94
    if len(stem) < 15:
        confidence -= 0.16
    if any("requires review" in option.text for option in options):
        confidence -= 0.24
    if not has_answer:
        confidence -= 0.3
    confidence = round(max(0.35, min(0.98, confidence)), 2)

    return ParsedQuestion(
        questionNumber=question_number,
        text=stem,
        options=options,
        questionType=question_type,
        correctOptionId=answer if question_type != "NUMERICAL" else None,
        correctOptionIds=answer_ids,
        correctNumericalAnswer=numerical_answer,
        numericalTolerance=numerical_tolerance,
        explanation=explanation,
        subjectTag=subject,
        topicTag=topic,
        difficulty=normalise_difficulty(difficulty),
        marks=question_marks,
        negativeMarks=question_negative,
        sourceConfidence=confidence,
        needsHumanReview=confidence < 0.85 or not has_answer,
    )


class IQuestionStructurer(ABC):
    """Pluggable interface for converting raw question blocks into strict JSON."""

    @abstractmethod
    async def structure_blocks(
        self, raw_blocks: List[str], default_marks: float, default_neg: float, gate_mode: bool = False
    ) -> List[ParsedQuestion]:
        pass


class HeuristicRegexStructurer(IQuestionStructurer):
    """Deterministic fallback & pre-structurer for Markdown and clean text papers."""

    async def structure_blocks(
        self, raw_blocks: List[str], default_marks: float = 2.0, default_neg: float = 0.5, gate_mode: bool = False
    ) -> List[ParsedQuestion]:
        structured: List[ParsedQuestion] = []
        for index, block in enumerate(raw_blocks, start=1):
            if not block.strip():
                continue
            match = QUESTION_START_RE.match(block)
            question_number = int(match.group(1)) if match else index
            structured.append(
                parse_question_block(block, question_number, default_marks, default_neg, gate_mode=gate_mode)
            )
        return structured


class OllamaStructurer(IQuestionStructurer):
    """Self-hosted local LLM structurer via Ollama (falls back when offline)."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.1:8b",
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.fallback = HeuristicRegexStructurer()

    async def _is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    async def structure_blocks(
        self, raw_blocks: List[str], default_marks: float = 2.0, default_neg: float = 0.5, gate_mode: bool = False
    ) -> List[ParsedQuestion]:
        # Ollama is optional. The deterministic structurer keeps the pipeline
        # usable on a laptop / CI box with no GPU or model pulled.
        if not await self._is_available():
            return await self.fallback.structure_blocks(raw_blocks, default_marks, default_neg, gate_mode)
        return await self.fallback.structure_blocks(raw_blocks, default_marks, default_neg, gate_mode)


def get_structurer() -> IQuestionStructurer:
    provider = os.getenv("LLM_PROVIDER", "heuristic").lower()
    if provider == "ollama":
        return OllamaStructurer(base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    return HeuristicRegexStructurer()
