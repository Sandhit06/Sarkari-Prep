# GATE CS 2027 Mock Test Engine — Detailed Parser and Placement README

This document is written for an AI model (or a developer) that needs to understand the
entire repository well enough to build a **drag-and-drop question-paper parser** that
extracts questions and places them, in a controlled order, into mock-test sessions.

It explains:

1. What the repository is and how its files fit together.
2. The canonical data model for a mock test, a slot, and a question.
3. The exact algorithm used to plan the 100 mock papers.
4. How actual questions are mapped into those planned slots.
5. How the published Markdown papers are ordered and rendered.
6. How validation, review, and scoring work.
7. How to design a parser and an intelligent placement engine that reproduces this
   behavior for an arbitrary uploaded question paper.
8. The current real state of the repository, including known gaps between the
   documentation and the data.

Read this document top to bottom before writing parser code. The most important
concept is:

> A mock paper is a fixed **schema of 65 numbered slots**. Questions are not simply
> appended to a list. Each question must be matched to a slot that already specifies
> its number, marks, section, subject preference, subtopic preference, and advisory
> question type. Ordering is therefore a **slot-first, question-second** problem.

---

## 1. Executive summary

The project is a GATE Computer Science and Information Technology (CS) 2027 mock-test
authoring, validation, publishing, and exam-simulation system.

The target exam format is:

| Property | Value |
|---|---|
| Duration | 180 minutes |
| Maximum marks | 100 |
| Total questions | 65 |
| Section A | General Aptitude, Q1–Q10 |
| Section B | Core CS + Engineering Mathematics, Q11–Q65 |
| Q1–Q5 | 1 mark each |
| Q6–Q10 | 2 marks each |
| Q11–Q35 | 1 mark each |
| Q36–Q65 | 2 marks each |
| Question types | MCQ, MSQ, NAT |
| GA marks | 15 |
| Engineering Mathematics marks | 13 |
| Core CS marks | 72 |
| Negative marking | MCQ only: -1/3 for 1-mark, -2/3 for 2-mark |
| MSQ scoring | All-or-nothing, no negative marking |
| NAT scoring | Numeric answer within accepted range, no negative marking |

The repository contains:

- `blueprints/` — the plan: 100 papers, 65 slots each, 6,500 planned slots.
- `data/questions.jsonl` — the canonical question bank, 6,500 records.
- `data/assembly_manifest.json` — provenance mapping from each destination slot to
  the source question/version used there.
- `data/adapted_variants_round2/3/4.jsonl` and `data/extra_questions.jsonl` —
  historical adaptation records used during a rapid completion pass.
- `papers/Mock_XXX/README.md` — student-facing question paper.
- `papers/Mock_XXX/SOLUTIONS.md` — worked solutions.
- `scripts/` — validation, rendering, acceptance, and reporting tools.
- `portal/` and `portal_server.py` — a 3-hour exam simulator and REST API.
- `reports/` — audits, coverage, review evidence, and known limitations.

The **placement process** is:

```text
syllabus.json + config.json
        |
        v
make_blueprints.py  ->  blueprints/papers.json  (100 x 65 planned slots)
        |
        v
authoring / assembly / adaptation
        |
        v
data/questions.jsonl  (one record per destination paper+number)
        |
        v
scripts/build.py  ->  papers/Mock_XXX/README.md + SOLUTIONS.md
        |
        v
portal_server.py  ->  /api/paper/<n>  ->  exam UI
```

The blueprint decides **where** a question goes. The question bank supplies **what**
goes there. The assembly manifest records **where it came from**.

---

## 2. Repository map

```text
GATE-MOCK-TESTS-master/
├── README.md                    Existing human-facing project overview
├── PARSER_README.md             This document
├── INDEX.md                     Master table of all 100 papers
├── CHECKPOINT.md                Chronological project status and review notes
├── pyproject.toml               Python project metadata
├── requirements.txt             Flask dependency for deployment
├── portal_server.py             Standard-library HTTP server + scoring engine
├── launch_portal.py             Launcher that opens the portal in a browser
├── launch_portal.bat            Windows double-click launcher
│
├── blueprints/
│   ├── config.json              Seed, difficulty targets, bounds, quotas
│   ├── syllabus.json            Canonical subject -> subtopic taxonomy
│   ├── make_blueprints.py       Deterministic 100-paper planner
│   ├── papers.json              Generated 100-paper slot specifications
│   ├── PLANNED_COVERAGE.md      Planned subtopic totals
│   └── README.md                Blueprint design notes
│
├── data/
│   ├── questions.jsonl          Canonical bank, one JSON object per line
│   ├── assembly_manifest.json   Destination slot -> source question mapping
│   ├── acceptance_log.jsonl     Audit log of accepted review transactions
│   ├── uniqueness_registry.json Structural signatures / fingerprints
│   ├── extra_questions.jsonl    Round-1 adaptation provenance
│   ├── adapted_variants_round2.jsonl
│   ├── adapted_variants_round3.jsonl
│   ├── adapted_variants_round4.jsonl
│   └── archive/                 Not present under data; backups are under /archive
│
├── papers/
│   └── Mock_001 ... Mock_100/
│       ├── README.md            Question paper
│       ├── SOLUTIONS.md         Worked solutions
│       └── assets/              Optional local images
│
├── scripts/
│   ├── common.py                Shared schema, rendering, validation, hashing
│   ├── build.py                 Publish a validated paper to Markdown
│   ├── validate.py              Structural and release audit
│   ├── accept_review.py         Import questions into the accepted bank
│   ├── report.py                Regenerate INDEX.md and coverage reports
│   ├── export.py                Optional HTML export
│   ├── fetch_2027_sources.py    Download official syllabus sources
│   ├── verify_*.py              Independent solver scripts
│   └── write_review_main.py     Review serializer
│
├── portal/
│   ├── index.html               Mock series dashboard
│   ├── exam.html                TCS iON-style exam screen
│   ├── paper_view.html          Markdown reader
│   ├── result.html              Scorecard and solutions
│   └── static/                  CSS and JavaScript
│
├── reports/                     Audits, coverage, model reviews, old validation dumps
├── research/                    Syllabus, historical papers, pattern analysis
├── drafts/                      Authoring scratch files and review JSON
├── tests/test_engine.py         13 adversarial unit tests
├── archive/                     Backups from earlier assembly/repair rounds
└── extra-practice/              Obsolete standalone sets; now only an index
```

---

## 3. The canonical data model

### 3.1 Syllabus taxonomy

`blueprints/syllabus.json` is the controlled vocabulary. It contains 11 top-level
subjects:

1. General Aptitude
2. Engineering Mathematics
3. Digital Logic
4. Computer Organization and Architecture
5. Programming and Data Structures
6. Algorithms
7. Theory of Computation
8. Compiler Design
9. Operating Systems
10. Databases
11. Computer Networks

The last nine are the "core CS" subjects. Every question's `subject` must be one of
these keys, and its `subtopic` must be one of the strings listed under that subject.
A parser must classify into this exact taxonomy, not into free-form labels.

### 3.2 Planned slot

A slot is a position in a paper. In `blueprints/papers.json`:

```json
{
  "number": 1,
  "subject": "General Aptitude",
  "subtopic": "Verbal grammar",
  "marks": 1,
  "difficulty": "Medium",
  "type": "MCQ"
}
```

A full paper object:

```json
{
  "paper": 1,
  "seed": 20271013,
  "slots": [ ... 65 slot objects ... ]
}
```

Slot fields are **targets**, not guarantees:

- `number`: final position, 1..65. This is the primary ordering key.
- `subject`: mandatory in validation.
- `subtopic`: preferred; the final paper may use another subtopic in the same subject.
- `marks`: mandatory; determined by position.
- `difficulty`: advisory editorial target; may be revised after solving.
- `type`: advisory; the blueprint README explicitly allows type changes when a sound
  question requires it.

### 3.3 Question record

The canonical bank `data/questions.jsonl` stores one JSON object per line. A fully
validated record has these fields:

```json
{
  "id": "CS27-M001-Q001",
  "paper": 1,
  "number": 1,
  "subject": "General Aptitude",
  "subtopic": "Verbal grammar",
  "type": "MCQ",
  "marks": 1,
  "difficulty": "Medium",
  "stem": "Choose the pair that completes the sentence grammatically. ...",
  "options": ["were; has", "was; have", "were; have", "was; has"],
  "answer": ["A"],
  "nat": null,
  "solution": "1. ...\n2. ...",
  "option_explanations": [
    "Both agreements are correct.",
    "Both verbs have the wrong number.",
    "The main verb must agree with Each, not instruments.",
    "The relative-clause verb must agree with instruments."
  ],
  "misconception": "A noun near a verb need not be that verb's grammatical subject.",
  "family": "ga_relative_clause_vs_main_agreement",
  "reasoning_pattern": "ga_relative_clause_vs_main_agreement",
  "structure_signature": "ga_relative_clause_vs_main_agreement",
  "reasoning_steps": 2,
  "references": ["research/SYLLABUS_2027.md"],
  "verification": {
    "status": "VERIFIED",
    "method": "Independent model reviewer re-derivation",
    "independent_solution": "...",
    "evidence": {"script": "scripts/verify_pilot_main.py", "run_output": "drafts/review_main_evidence.json"},
    "reviewed_content_hash": "sha256 hex digest",
    "review_provenance": "Separate model review; no human review claimed."
  },
  "validation_status": "ACCEPTED",
  "assets": []
}
```

The exact required field set in `scripts/common.py` is:

```text
id, paper, number, subject, subtopic, type, marks, difficulty, stem, options,
answer, nat, solution, option_explanations, misconception, family,
reasoning_pattern, structure_signature, reasoning_steps, references,
verification, validation_status, assets
```

Field semantics:

- `id`: deterministic. Must equal `CS27-M{paper:03d}-Q{number:03d}`. Example:
  paper 7, question 42 -> `CS27-M007-Q042`.
- `paper`: integer 1..100.
- `number`: integer 1..65.
- `subject`: exact syllabus key.
- `subtopic`: exact syllabus string under that subject.
- `type`: `"MCQ"`, `"MSQ"`, or `"NAT"`.
- `marks`: 1 or 2, constrained by position.
- `difficulty`: `"Medium"`, `"Medium-Hard"`, `"Hard"`, or `null` in unfinished records.
- `stem`: question text. May contain Markdown, tables, code fences, and LaTeX-like text.
- `options`: for MCQ/MSQ, exactly four non-empty distinct strings. For NAT, `[]`.
- `answer`:
  - MCQ: list with exactly one letter, e.g. `["A"]`.
  - MSQ: list with 2–4 distinct letters under this project's validator.
  - NAT: a number (integer or float), not a list.
- `nat`: for NAT only, `{"min": number, "max": number, "precision": integer >= 0}`.
  For MCQ/MSQ it is `null`.
- `solution`: complete worked derivation.
- `option_explanations`: for MCQ/MSQ, exactly four strings, one per option.
- `misconception`: a short explanation of the common wrong mental model.
- `family` / `reasoning_pattern` / `structure_signature`: novelty and duplication
  metadata. Values are normalized strings.
- `reasoning_steps`: integer count of meaningful reasoning steps.
- `references`: list of local source paths.
- `verification`: independent review evidence. Must be `status == "VERIFIED"` and
  contain a `reviewed_content_hash` that matches the current content.
- `validation_status`: `"ACCEPTED"` for a fully accepted question.
- `assets`: list of relative paths under `papers/Mock_XXX/`; no external URLs.

### 3.4 Assembly assignment

`data/assembly_manifest.json`:

```json
{
  "version": 1,
  "seed": 20271025,
  "reuse_policy": "Cross-paper reuse permitted; at most three occurrences per source.",
  "assignments": [
    {
      "id": "CS27-M037-Q012",
      "paper": 37,
      "number": 12,
      "source_id": "CS27-W0253",
      "subject": "Digital Logic",
      "subtopic": "Tabular minimization",
      "requested_subtopic": "Tabular minimization",
      "marks": 1,
      "type": "MCQ",
      "source_text_hash": "164e65cb...",
      "original_source_id": "CS27-M008-Q030",
      "original_source_snapshot": "archive/integrated-variants-2026-10-25/data/questions.jsonl"
    }
  ]
}
```

Meaning:

- `id`, `paper`, `number`: the **destination** slot.
- `source_id`: the source record/version used to fill the slot. It may be:
  - a normal question ID: `CS27-M001-Q001`;
  - an adapted version ID: `CS27-X0001`, `CS27-Y0001`, `CS27-Z0001`, `CS27-W0001`.
- `subject`, `marks`: must match the destination slot.
- `subtopic`: actual subtopic used.
- `requested_subtopic`: subtopic the blueprint asked for. In 232 slots these differ;
  the difference is allowed only within the same subject.
- `type`: actual type. It can differ from the blueprint because type is advisory.
- `source_text_hash`: hash of the source text snapshot.
- Optional `original_source_id` and `original_source_snapshot`: provenance for adapted
  versions.

### 3.5 Adapted variants

The rapid completion pass created four adaptation families:

| File | ID prefix | Count | Adaptation |
|---|---|---:|---|
| `data/extra_questions.jsonl` | `CS27-X` | 1,000 | `incorrect-answer-selection` (646), `correct-pair` (354) |
| `data/adapted_variants_round2.jsonl` | `CS27-Y` | 1,000 | `NAT-to-MCQ` |
| `data/adapted_variants_round3.jsonl` | `CS27-Z` | 1,000 | `NAT-to-invalid-answer-MSQ` |
| `data/adapted_variants_round4.jsonl` | `CS27-W` | 800 | `candidate-validity-audit` |

These records include `source_id`, `integrated_destination_id`, `original_source_id`,
`adaptation`, and answer-mapping metadata. They are provenance records, not extra
active questions. The destination question in `data/questions.jsonl` is the live one.

Important adaptation semantics:

- `correct-pair`: asks for the complementary correct pair/set.
- `incorrect-answer-selection`: asks the student to select every option that is **not**
  a valid answer.
- `NAT-to-MCQ`: converts a numeric-answer question into a four-option MCQ.
- `NAT-to-invalid-answer-MSQ`: converts a NAT into an MSQ selecting all invalid
  numeric candidates.
- `candidate-validity-audit`: presents candidate answers and asks which remain valid.

A parser that imports these must preserve the adaptation rule, because the answer set
is the complement or a transformed set of the source answer, not the source answer.

### 3.6 Rendered paper

`papers/Mock_XXX/README.md` has this exact structure:

```markdown
# GATE CS 2027 — Full-Length Mock Test 001

**Paper Code:** CS
**Duration:** 180 Minutes
**Maximum Marks:** 100
**Total Questions:** 65
**Difficulty:** Medium to Hard

## General Instructions
...

---

## Section A — General Aptitude

### Q1. [1 Mark] [MCQ]

<stem>

A. option one
B. option two
C. option three
D. option four

### Q2. [1 Mark] [NAT]

<stem>

**Answer format:** Numeric value; integer.

...

---

## Section B — Computer Science and Engineering Mathematics

### Q11. [1 Mark] [MCQ]
...

---

## ANSWER KEY — MOCK TEST 001

| Question | Type | Marks | Correct Answer |
|---|---|---|---|
| 1 | MCQ | 1 | A |
...
```

`papers/Mock_XXX/SOLUTIONS.md` has one section per question:

```markdown
## Q1

**Correct answer:** A

**Concept:** General Aptitude — Verbal grammar

<worked solution>

- **A:** ...
- **B:** ...
- **C:** ...
- **D:** ...

**Common misconception:** ...
```

Ordering rules for rendered output:

- Questions are sorted by `number` ascending.
- Section A is exactly Q1–Q10.
- Section B starts at Q11, not at the first core subject.
- In Section B, Engineering Mathematics and core subjects are interleaved based on the
  shuffled slot plan. Do not sort Section B by subject.
- The answer key is always at the end, after Q65.
- For NAT, `answer_text` formats the numeric answer with `nat.precision` and appends
  the accepted range or `(exact)`.

---

## 4. The GATE paper contract

These invariants are enforced by `scripts/common.py:validate_records`. A parser and
placement engine should enforce the same rules.

### 4.1 Positional rules

```text
Q1–Q5    1 mark   General Aptitude
Q6–Q10   2 marks  General Aptitude
Q11–Q35  1 mark   Core CS or Engineering Mathematics
Q36–Q65  2 marks  Core CS or Engineering Mathematics
```

Therefore:

- 30 one-mark questions and 35 two-mark questions.
- 10 GA questions, 15 marks.
- 9 Engineering Mathematics questions, 13 marks: five 1-mark and four 2-mark.
- 46 core CS questions, 72 marks: twenty 1-mark and twenty-six 2-mark.
- All nine core subjects must be present in every paper.
- Total marks must equal 100.

### 4.2 Type rules

- MCQ: four distinct options, exactly one correct letter.
- MSQ: four distinct options, 2–4 correct letters in this project, no partial credit.
- NAT: no options, numeric answer, `nat.min <= answer <= nat.max`, non-negative
  integer precision.
- MCQ/MSQ must have exactly four non-empty `option_explanations`.
- NAT must have `nat` metadata.

### 4.3 Review rules

- `validation_status` must be `"ACCEPTED"`.
- `verification.status` must be `"VERIFIED"`.
- `verification.method`, `independent_solution`, and `evidence` must be non-empty.
- `verification.reviewed_content_hash` must equal the hash of the current record.

The content hash is computed in `scripts/common.py:reviewed_content_hash`:

```text
payload = {
  "id": ...,
  "stem": ...,
  "options": ...,
  "answer": ...,
  "nat": ...,
  "solution": ...,
  "option_explanations": ...
}
hash = SHA-256(JSON(payload, sort_keys=True, compact separators, ensure_ascii=False))
```

This binds a review to the exact content. If a stem, option, answer, NAT range,
solution, or option explanation changes, the review becomes stale and the question
cannot be published.

### 4.4 Difficulty rules

`blueprints/config.json` specifies:

```json
{
  "seed": 20271012,
  "paper_count": 100,
  "difficulty_counts": {"Medium": 26, "Medium-Hard": 29, "Hard": 10},
  "difficulty_bounds": {
    "Medium": [24, 28],
    "Medium-Hard": [27, 31],
    "Hard": [8, 12]
  },
  "minimum_multistep_technical": 28,
  "core_one_mark_base": 2,
  "core_two_mark_base": 2
}
```

For a fully reviewed paper:

- Medium count must be between 24 and 28.
- Medium-Hard count must be between 27 and 31.
- Hard count must be between 8 and 12.
- At least 28 non-GA technical questions must have `reasoning_steps >= 2`.

Difficulty is an editorial label, not an empirically calibrated measurement.

### 4.5 Duplicate rules

`scripts/common.py:duplicate_warnings` checks four keys:

1. `exact`: normalized stem text.
2. `numeric_normalized`: normalized stem with all numbers replaced by `#`.
3. `family_reasoning`: normalized `family + "|" + reasoning_pattern`.
4. `structure`: normalized `structure_signature`.

It also computes 4-gram Jaccard similarity and lexical Jaccard similarity:

- n-gram near duplicate if Jaccard >= 0.62.
- lexical near duplicate if lexical Jaccard >= 0.90 and n-gram Jaccard >= 0.20.

There is no embedding model. The code explicitly says the heuristics do not prove
originality.

The active repository policy (after the user allowed repetition) is:

- Cross-paper reuse is permitted.
- Each source question occurs at most three times across all 100 papers.
- No exact repeat occurs inside any one paper.
- New papers take at most four questions from any one source paper.
- The 65 previously accepted records are preserved verbatim.

---

## 5. Stage 1 — How the 100 papers are planned

The planner is `blueprints/make_blueprints.py`. It is deterministic and uses only
`blueprints/config.json`, `blueprints/syllabus.json`, and the seed.

### 5.1 The exact algorithm

Let:

- `core = [Digital Logic, Computer Organization and Architecture, Programming and Data
  Structures, Algorithms, Theory of Computation, Compiler Design, Operating Systems,
  Databases, Computer Networks]` (9 subjects).
- `p` be the 1-indexed paper number.

For each paper:

```text
GA = 10 slots

one_mark = []
for each core subject:
    add that subject twice                      # 18 slots
for i in [0, 1]:
    add core[(p - 1 + 4*i) % 9]                 # 2 rotating slots
add Engineering Mathematics 5 times             # 5 slots
# total 25 one-mark slots, Q11-Q35

two_mark = []
for each core subject:
    add that subject twice                      # 18 slots
for i in [0..7]:
    add core[(p - 1 + i) % 9]                   # 8 rotating slots
add Engineering Mathematics 4 times             # 4 slots
# total 30 two-mark slots, Q36-Q65

shuffle(one_mark) using random.Random(seed + p)
shuffle(two_mark) using random.Random(seed + p)

assignment = [General Aptitude] * 10 + one_mark + two_mark
```

The base allocation guarantees:

- Every core subject gets two one-mark and two two-mark slots.
- Remaining core slots rotate across papers.
- Engineering Mathematics gets exactly five one-mark and four two-mark slots.
- GA is always the first ten slots.
- The one-mark and two-mark lists are shuffled independently.

### 5.2 Subtopic selection

Subtopic selection is a global cursor, not a per-paper reset:

```python
cursors = Counter()

for each slot in paper order:
    subject = slot.subject
    order = topic_order.get(subject, list(range(len(topics[subject]))))
    subtopic = topics[subject][order[cursors[subject] % len(order)]]
    cursors[subject] += 1
```

`topic_order` is customized for GA and EM to interleave their four areas:

```python
topic_order = {
  "General Aptitude": [0, 4, 11, 13, 2, 6, 10, 14, 3, 9, 1, 5, 12, 15, 7, 8],
  "Engineering Mathematics": [0, 7, 10, 13, 1, 8, 11, 14, 2, 9, 12, 15, 3, 4, 5, 6]
}
```

Core subjects use syllabus order. Because the cursor is global and increments only
when that subject appears, the series cycles through every subtopic repeatedly and
deterministically.

### 5.3 Difficulty assignment

For each paper:

```text
GA difficulty:
  Q1–Q8   Medium
  Q9–Q10  Medium-Hard

one-mark technical difficulty pool (25 values):
  12 Medium, 10 Medium-Hard, 3 Hard
  shuffle

two-mark technical difficulty pool (30 values):
  6 Medium, 17 Medium-Hard, 7 Hard
  shuffle

levels = GA + shuffled_low + shuffled_high
```

Resulting exact counts per paper:

- Medium: 8 + 12 + 6 = 26
- Medium-Hard: 2 + 10 + 17 = 29
- Hard: 3 + 7 = 10

### 5.4 Type assignment

```python
forced_mcq_ga_subtopics = {
  "Verbal grammar", "Vocabulary in context", "Reading comprehension",
  "Narrative sequencing", "Spatial transformations", "Paper folding and cutting"
}

type = "MCQ" if subject == "General Aptitude" and subtopic in forced_mcq_ga_subtopics
       else random.choices(["MCQ", "MSQ", "NAT"], [5, 2, 3])[0]
```

The weighted random draw uses `random.Random(seed + p)`, so it is reproducible. The
actual question bank may change the type during authoring; the blueprint type is only
a planning target.

### 5.5 Marks assignment

Marks are purely positional:

```python
marks = 1 if number <= 5 or 11 <= number <= 35 else 2
```

This is why a parser must never infer marks from the source paper's own numbering
without also mapping to the target slot positions.

### 5.6 What the planner does not do

`make_blueprints.py` does not create questions, choose answers, or render papers. It
only writes `blueprints/papers.json` and `blueprints/PLANNED_COVERAGE.md`.

The resulting `papers.json` contains 100 paper objects, each with 65 slot objects,
for exactly 6,500 planned slots.

---

## 6. Stage 2 — How questions enter the bank

There are two paths:

### 6.1 Strict review path

`scripts/accept_review.py` is the gatekeeper.

Inputs:

- one or more authored question JSON files;
- one or more review JSON files keyed by question ID.

For each incoming question it requires:

- a review with `verdict` `"PASS"` or `"VERIFIED"` and no unresolved issues;
- the review answer equals the question answer;
- the review's `reviewed_content_hash` equals the current content hash;
- a paper whose records still pass `validate_records`;
- no unresolved duplicate warnings.

On success it:

- attaches verification metadata;
- sets `validation_status = "ACCEPTED"`;
- appends to `data/questions.jsonl`;
- appends an audit event to `data/acceptance_log.jsonl`.

A question cannot replace an existing accepted record with different content. That
requires a separately reviewed revision workflow.

### 6.2 Fast completion path used in this repository

To finish 100 papers quickly, the project assembled later papers from existing source
questions and adapted variants. The evidence is:

- `data/assembly_manifest.json` (6,500 assignments);
- `data/extra_questions.jsonl` (1,000 X variants);
- `data/adapted_variants_round2.jsonl` (1,000 Y variants);
- `data/adapted_variants_round3.jsonl` (1,000 Z variants);
- `data/adapted_variants_round4.jsonl` (800 W variants);
- `reports/INTEGRATED_1000_REPLACEMENTS.md`,
  `reports/INTEGRATED_1000_ROUND2_REPLACEMENTS.md`,
  `reports/INTEGRATED_1000_ROUND3_REPLACEMENTS.md`,
  `reports/ROUND4_REPLACEMENTS.md`.

Important: the repository does **not** contain the script that performed this
assembly. The manifest and variant files are the authoritative provenance artifacts.
If you rebuild the system, write the assembly/placement algorithm yourself using the
rules in this document.

Current counts from the data:

- 6,500 question instances.
- 6,500 unique deterministic IDs.
- 6,150 distinct normalized question versions.
- 350 excess exact occurrences across papers.
- No exact normalized repeat within a single paper.
- 65 records are `ACCEPTED` and `VERIFIED` (Mock 001).
- 6,435 records are `REVIEW_REQUIRED` / `INDEPENDENT_REVIEW_PENDING`.

---

## 7. Stage 3 — How a question is placed in a mock session

This is the core process the user wants to reproduce.

### 7.1 The destination key

A destination is uniquely identified by:

```text
(paper_number, question_number)
```

The canonical ID is derived from it:

```text
CS27-M{paper_number:03d}-Q{question_number:03d}
```

Examples:

- `(1, 1)` -> `CS27-M001-Q001`
- `(37, 12)` -> `CS27-M037-Q012`
- `(100, 65)` -> `CS27-M100-Q065`

The ID encodes the **destination**, not the source. The assembly manifest separately
records the source.

### 7.2 Hard and soft constraints

When filling a slot, the following constraints apply.

Hard constraints (must pass):

1. `question.subject == slot.subject`.
2. `question.marks == slot.marks`.
3. The destination `(paper, number)` is unique.
4. The destination ID matches the deterministic format.
5. The destination paper ends with exactly 65 questions, numbers 1..65.
6. Positional marks and section rules hold.
7. The overall paper reaches 15 GA marks, 13 EM marks, and 72 core marks.
8. No exact duplicate question occurs inside the same paper.
9. The source reuse count does not exceed three across the series.
10. The record passes the canonical schema and validation gates.

Soft constraints (prefer, but may be overridden):

1. `question.subtopic == slot.subtopic` (the requested subtopic).
2. `question.type == slot.type`.
3. `question.difficulty == slot.difficulty`.
4. Prefer not to reuse the same `family`, `reasoning_pattern`, or
   `structure_signature` in the same paper.
5. Prefer a source paper that has not already contributed four questions to this
   destination paper.
6. Prefer questions that preserve the uploaded paper's original order when the source
   paper is being converted directly into a target paper.

In this repository, subject and marks are exact; type is advisory; subtopic is
preferred but may change within the same subject. The manifest shows 232 subtopic
substitutions and 4,109 blueprint-vs-actual type differences.

### 7.3 The actual assembly pattern

The data shows two phases:

- **Papers 001–036:** the destination record and the source record are the same ID.
  These papers were authored/revised in place.
- **Papers 037–100:** destinations are filled from a pool of earlier source questions
  and adapted variants. Each destination uses a source ID that may be:
  - an original `CS27-Mxxx-Qyyy`;
  - an `X`, `Y`, `Z`, or `W` adapted version.

The manifest preserves the requested destination subtopic even when the actual source
subtopic differs. Example:

```text
Mock 047 Q18: requested "CPU scheduling" -> actual "Virtual memory"
```

That is legal only because both are in the same subject and the paper still satisfies
all marks and subject totals.

### 7.4 Deterministic ordering

Once all slots are filled:

1. Sort the 65 records by `number` ascending.
2. Do not reorder by subject.
3. Section A is the first ten records.
4. Section B is records 11–65.
5. Renumber if necessary so the final positions are exactly 1..65.
6. Render the answer key in the same order.
7. Render solutions in the same order.

The order is therefore an artifact of the slot numbers, not of the order in which the
source questions were found.

### 7.5 What "in order" means for a parser

For a drag-and-drop parser, there are two distinct orders:

- **Source order:** the order in which questions appear in the uploaded paper.
- **Target order:** the order of the 65 target slots.

Do not confuse them. A source paper may have 65 questions, but its Q1 may be a core
question while the target Q1 must be General Aptitude. The parser must classify and
then place each question into the target slot that matches subject and marks. If the
source paper is itself a GATE-format paper, its own order is already structurally
correct, but the target series may still require a different subtopic mix.

Recommended behavior:

1. Parse the source paper and preserve `source_number`.
2. Classify each question by subject, subtopic, type, and marks.
3. Build the target slot plan for the chosen mock series.
4. Match questions to slots by subject+marks first, then subtopic/type/difficulty.
5. If the source is a full GATE paper and the target is a full GATE paper, prefer
   matching `source_number` to `target_number` when the subject+marks constraints
   agree.
6. Preserve source provenance in a manifest; do not silently discard it.

---

## 8. Stage 4 — Validation gates

### 8.1 Record-level validation

`scripts/common.py:validate_records` checks:

- Exactly 65 records per paper.
- Numbers are exactly 1..65 with no gaps or repeats.
- IDs are unique and deterministic.
- Every required field is present.
- `paper` matches the destination paper.
- `subject` is a syllabus key and `subtopic` is a valid child.
- Type is MCQ/MSQ/NAT.
- Positional marks are correct.
- GA is exactly Q1–Q10; non-GA is exactly Q11–Q65.
- Marks total 100.
- 30 one-mark and 35 two-mark questions.
- GA is 10 questions / 15 marks.
- Engineering Mathematics is 5 one-mark + 4 two-mark, 13 marks.
- Core CS is 72 marks.
- All nine core subjects appear.
- At least 28 technical questions have `reasoning_steps >= 2`.
- Difficulty counts are within configured bounds.
- Every record is `ACCEPTED` and `VERIFIED`.
- Every verification hash matches.
- MCQ/MSQ have four distinct options, valid answer sets, four explanations, and no
  NAT metadata.
- NAT has no options, a numeric answer within `nat.min`..`nat.max`, and valid
  precision.
- Assets are relative, inside the paper folder, and exist.

### 8.2 Render validation

`scripts/common.py:validate_rendered` re-renders the canonical records and compares
the result byte-for-byte with the saved Markdown. It also checks:

- the files exist;
- fenced code blocks are balanced;
- all Markdown links are local and exist;
- no external resource URLs are used.

### 8.3 Global validation

`scripts/validate.py:audit` also checks:

- global ID uniqueness;
- duplicate warnings;
- registry generation;
- final release: 100 papers, 6,500 records, all 100 README files, all 6,500 records
  accepted and verified;
- research readiness flags in `research/release_readiness.json`.

### 8.4 Current repository reality

The documentation and the actual current bank are not fully consistent. An AI or
developer must know this:

- `INDEX.md` and `FINAL_VALIDATION_REPORT.md` describe a successful structural audit
  of 100 papers.
- `reports/validation.json` is stale: it describes only 65 records and 99 failed
  papers. Do not treat it as the current state.
- The current `data/questions.jsonl` contains 6,500 records, but 6,435 are
  `REVIEW_REQUIRED` and many lack `misconception`, `option_explanations`, and
  `reasoning_steps`.
- Many current records have `difficulty: null`; `planned_difficulty` is stored
  separately.
- Some current records have `reasoning_pattern: null`, which causes
  `scripts/validate.py` to raise a `TypeError` in `duplicate_warnings` before it can
  finish.
- Therefore the strict publishing engine cannot currently be run end-to-end on the
  full assembled bank without a cleanup/normalization step.

This is expected: the project prioritized content population and structural
consistency, while independent correctness and difficulty review remain pending.

For a new parser, do not copy the unfinished record shape. Use the fully validated
shape in Section 3.3 as your output target.

---

## 9. Stage 5 — Rendering and serving

### 9.1 Markdown rendering

`scripts/common.py:render_paper(questions, paper)` produces two strings:

- `README.md`
- `SOLUTIONS.md`

`scripts/build.py` writes them only after the audit passes, and it refuses to
overwrite a differing published file. This protects released papers.

`scripts/export.py` can convert Markdown to standalone HTML if the optional
`markdown-it-py==3.0.0` dependency is installed.

### 9.2 Portal server

`portal_server.py` loads `data/questions.jsonl` into memory and indexes by paper:

```python
QUESTIONS_BY_PAPER[paper] = [...]
```

Each list is sorted by `number`. The summaries include counts by type, difficulty,
subject, section A, and section B.

API endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/papers` | List all 100 paper summaries |
| GET | `/api/stats` | Overall paper/question/format stats |
| GET | `/api/paper/<n>` | Exam-mode questions; answers hidden |
| GET | `/api/paper/<n>/solutions` | Full questions including answers/solutions |
| POST | `/api/paper/<n>/submit` | Grade a submission |

The exam-mode sanitizer returns only:

```text
id, paper, number, subject, subtopic, type, marks, difficulty, stem, options,
nat_precision
```

It deliberately removes answers, solutions, explanations, and misconception.

### 9.3 Scoring

`portal_server.py:evaluate_submission` implements:

- MCQ 1 mark: +1 correct, -1/3 incorrect, 0 unattempted.
- MCQ 2 marks: +2 correct, -2/3 incorrect, 0 unattempted.
- MSQ: full marks only if the selected set exactly equals the correct set; no negative.
- NAT: full marks if the response is within `[min - 1e-5, max + 1e-5]`; no negative.

It also computes:

- section A score (Q1–Q10);
- section B score (Q11–Q65);
- per-subject breakdown;
- estimated GATE score out of 1000;
- estimated AIR bracket;
- qualification against a 27.5 cutoff.

These estimates are illustrative, not official GATE results.

### 9.4 Exam UI ordering

`portal/static/js/exam.js`:

- Stores `currentIndex` 0..64.
- Treats `activeSection` 1 as Q1–Q10 and 2 as Q11–Q65.
- Switches to index 0 or 10 when the section tab is clicked.
- Renders palette section headers at question 1 and question 11.
- Auto-saves progress to `localStorage` every 5 seconds.

The UI order is therefore exactly the paper order: Q1, Q2, ..., Q65.

---

## 10. Building the drag-and-drop parser

This section is the practical blueprint for the parser the user wants to build.

### 10.1 Target architecture

```text
Uploaded file(s)
      |
      v
[1] ingest        PDF / DOCX / images / Markdown -> text + layout + images
      |
      v
[2] segment       detect paper title, sections, question boundaries, options,
                  code blocks, tables, figures, answer key, solutions
      |
      v
[3] extract       per-question fields: stem, options, answer, solution,
                  marks, type, subject guess, subtopic guess
      |
      v
[4] normalize     canonical types, answer sets, NAT ranges, IDs, encodings
      |
      v
[5] validate      schema + structural checks + duplicate checks
      |
      v
[6] plan          load or generate the target 65-slot blueprint
      |
      v
[7] assign        match questions to slots under hard/soft constraints
      |
      v
[8] materialize   sort by slot number, renumber, write JSONL + manifest
      |
      v
[9] render        generate README/SOLUTIONS or feed the portal API
```

### 10.2 Phase 1: Ingestion

Support at least:

- text-based PDF: PyMuPDF, pdfplumber, or pypdf;
- scanned PDF/images: OCR (Tesseract or a vision model);
- DOCX: python-docx;
- Markdown/HTML: parse directly;
- pasted text: treat as a single text stream.

Preserve:

- page number;
- bounding boxes if available;
- reading order;
- tables as structured data;
- code blocks;
- image references and figure captions.

Do not rely on plain text extraction alone for GATE papers. Code, tables, and
figures carry meaning. A parser that flattens a code block can change the answer.

### 10.3 Phase 2: Segmentation

Detect:

- paper title;
- instructions;
- section headings: `General Aptitude`, `Computer Science`, `Section A`, `Section B`;
- question starts: `Q.1`, `Q1.`, `Question 1`, `1.`, `1)` and similar;
- option starts: `A.`, `(A)`, `A)`, `Option A`;
- answer-key headings: `Answer Key`, `ANSWER KEY`;
- solution headings: `Solutions`, `Worked Solutions`;
- code fences and indented code;
- tables and figure captions.

Use layout signals, not only regex:

- A line starting at the left margin and matching a question marker is likely a new
  question.
- Option markers usually form a contiguous block of 4.
- A question may span multiple pages; a page header/footer should not split it.
- A code block may contain lines that look like options; fence/indent detection must
  win.

Output a list of raw blocks:

```json
{
  "source_number": 17,
  "page_start": 4,
  "page_end": 5,
  "raw_text": "...",
  "blocks": [
    {"kind": "stem", "text": "..."},
    {"kind": "code", "text": "..."},
    {"kind": "table", "rows": [...]},
    {"kind": "option", "label": "A", "text": "..."}
  ]
}
```

### 10.4 Phase 3: Field extraction

For each segmented question, extract:

- `stem`: the complete question text, including code and table references.
- `options`: four options for MCQ/MSQ, none for NAT.
- `type_guess`: MCQ if four options; NAT if numeric answer format and no options;
  MSQ if the stem says "select all", "which of the following are true", or the
  answer key has multiple letters.
- `marks_guess`: from the heading (`[1 Mark]`, `[2 Marks]`) or from the source
  section; if absent, use the target slot's marks, not a guess.
- `subject_guess` / `subtopic_guess`: classify against `syllabus.json`.
- `answer_guess`: parse the answer key if present; otherwise mark as unresolved.
- `solution_guess`: parse the solutions document if present; otherwise leave empty.
- `confidence`: per-field confidence.
- `provenance`: page/file/offset.

Never invent an answer. If the answer key is absent, the question must remain
`REVIEW_REQUIRED`. The downstream validator must reject it from a published mock.

### 10.5 Phase 4: Normalization

Normalization must produce the canonical schema.

#### Question IDs

```python
id = f"CS27-M{paper:03d}-Q{number:03d}"
```

#### MCQ/MSQ answers

- Normalize to uppercase letters.
- Deduplicate.
- Sort letters.
- MCQ must contain exactly one letter.
- MSQ must contain 2–4 letters in this project.
- Reject empty or invalid answers.

#### NAT answers

- Parse decimal values.
- Store the canonical numeric answer in `answer`.
- Store `nat.min`, `nat.max`, `nat.precision`.
- If the source gives only a single number, set `min == max == answer`.
- If the source gives a range, preserve it.
- Precision is the number of decimal places expected in the answer.

#### Type conversion

If a source NAT has been adapted to MCQ/MSQ, do not copy the source answer. Use the
adaptation rule:

- NAT-to-MCQ: answer is the letter of the numerically correct option.
- NAT-to-invalid-answer-MSQ: answer is the set of all invalid options.
- incorrect-answer-selection: answer is the complement of the valid set.
- correct-pair: answer is the mapped pair, not necessarily the source letter.

#### Text normalization

- Decode as UTF-8 with BOM tolerance.
- Normalize CRLF to LF.
- Collapse accidental repeated whitespace, but preserve code indentation and Markdown.
- Normalize Unicode dashes/quotes only if the renderer expects it; be careful not to
  alter mathematical symbols.
- Strip page headers/footers.
- Keep source-language spelling.

### 10.6 Phase 5: Classification

The parser must map each question to `(subject, subtopic)` in the canonical taxonomy.

Recommended strategy:

1. Rule-based keyword scoring per subject and subtopic.
2. A learned classifier or LLM fallback for ambiguous questions.
3. Validate the result against `syllabus.json`.
4. If confidence is below a threshold, flag the question for human review rather than
   forcing a subject.

Suggested keyword examples:

- Operating Systems: process, thread, deadlock, semaphore, page, TLB, scheduler, inode.
- Databases: SQL, relation, tuple, functional dependency, B+ tree, transaction.
- Computer Networks: IP, TCP, UDP, router, subnet, DNS, HTTP, Ethernet.
- Theory of Computation: DFA, NFA, regular expression, CFG, PDA, Turing, decidable.
- Compiler Design: lexer, parser, grammar, LL(1), LR, syntax tree, liveness.
- Digital Logic: Boolean, K-map, flip-flop, multiplexer, adder, floating point.
- COA: cache, pipeline, ISA, addressing mode, ALU, DMA, interrupt.
- PDS: C pointer, array, linked list, stack, queue, tree, heap, graph representation.
- Algorithms: sorting, hashing, greedy, DP, divide and conquer, MST, shortest path.
- Engineering Mathematics: logic, set, group, matrix, eigenvalue, probability,
  calculus, recurrence.
- General Aptitude: verbal, vocabulary, comprehension, ratio, percentage, series,
  geometry, probability, data interpretation, logic, spatial.

Do not classify "probability" in GA and "probability" in Engineering Mathematics by
keyword alone. Use the surrounding stem and the intended section.

### 10.7 Phase 6: Slot planning

For a target series, use one of two modes.

#### Mode A: Reproduce this repository's plan

Run the equivalent of `make_blueprints.py` with the same seed and config. This gives
exactly the 100-paper plan in `blueprints/papers.json`.

#### Mode B: Build a new plan

Given a requested number of papers and a syllabus, generate slots with the same
contract:

- 10 GA slots;
- 25 one-mark Section B slots;
- 30 two-mark Section B slots;
- exact subject quotas;
- rotating subtopics;
- difficulty targets;
- type targets.

Always write the plan to a JSON file before assignment. The plan is the contract; the
questions are interchangeable content.

### 10.8 Phase 7: Assignment algorithm

This is the intelligent placement core.

#### Step 1: Build candidate pools

```python
pools = {}
for q in questions:
    pools.setdefault((q.subject, q.marks), []).append(q)
```

Subject and marks are hard constraints. Never search across them.

#### Step 2: Score each candidate for each slot

```python
def score(q, slot, state):
    if q.subject != slot.subject: return -inf
    if q.marks != slot.marks: return -inf
    if q.id in state.used_in_paper: return -inf
    if state.reuse_count[q.source_id] >= 3: return -inf

    s = 0
    if q.subtopic == slot.subtopic: s += 50
    elif q.subject == slot.subject: s += 5
    if q.type == slot.type: s += 10
    if q.difficulty == slot.difficulty: s += 8
    if q.source_paper == state.destination_paper: s += 2
    if state.source_paper_count[q.source_paper] >= 4: s -= 20
    if q.family in state.used_families: s -= 25
    if q.structure_signature in state.used_structures: s -= 25
    if q.reasoning_steps >= 2: s += 2
    s += stable_tiebreak(q.id) * 0.001
    return s
```

Use negative infinity or `None` for hard failures, not a large negative number that
could accidentally win.

#### Step 3: Choose an assignment method

For a single 65-slot paper with a larger candidate bank, a deterministic greedy
algorithm is usually sufficient:

1. Sort slots by scarcity: slots with the fewest eligible candidates first.
2. For each slot, pick the highest-scoring unused candidate.
3. If no candidate exists, backtrack: release the lowest-confidence previous
   assignment and try an alternative.
4. Keep a small search budget (for example, 10,000 backtracks).

For a series or for optimal quality, use a min-cost max-flow / Hungarian assignment:

- Left nodes: destination slots.
- Right nodes: questions.
- Edge only if subject and marks match.
- Cost: negative score.
- Capacity: one question per slot, one slot per question.
- Add paper-level constraints by solving one paper at a time and maintaining global
  reuse counts across papers.

For strict no-duplicate/no-reuse constraints, an ILP solver (OR-Tools CP-SAT) is the
most robust option, but the repository itself is standard-library-only, so a
deterministic greedy with backtracking is the closest match to its philosophy.

#### Step 4: Enforce series-level constraints

After each paper:

- Increment `reuse_count[source_id]`.
- Increment `source_paper_count[destination_paper][source_paper]`.
- Record the assignment in the manifest.
- Reject a paper if a core subject is missing, marks are wrong, or a slot is unfilled.

#### Step 5: Fill or fail

Two policies are acceptable:

- **Strict:** do not publish a paper with any empty slot.
- **Repair:** fill an empty slot by authoring a new question or by adapting a candidate;
  never silently insert an unrelated question.

For a parser, strict is safer. Surface a report of unfilled slots to the user.

### 10.9 Phase 8: Ordering and materialization

After assignment:

1. Sort records by `slot.number`.
2. Verify Q1–Q10 are GA, Q11–Q65 are non-GA.
3. Verify marks by position.
4. Verify totals.
5. Assign canonical IDs from the destination.
6. Write:
   - `data/questions.jsonl` (one record per line);
   - `data/assembly_manifest.json` (destination -> source);
   - `papers/Mock_XXX/README.md`;
   - `papers/Mock_XXX/SOLUTIONS.md`.

Do not write files until all validation passes.

### 10.10 Phase 9: Validation before publishing

Run the same checks as `scripts/common.py:validate_records`:

- count, numbering, IDs;
- syllabus membership;
- positional marks;
- GA/EM/core totals;
- all core subjects;
- type/option/answer/NAT rules;
- review status and hash;
- difficulty bounds;
- reasoning-step quota;
- assets.

Then run `validate_rendered` on the generated Markdown. If any check fails, block the
publish.

---

## 11. Parser output schemas

### 11.1 Extracted question before placement

```json
{
  "source": {
    "file": "uploaded/paper.pdf",
    "page_start": 3,
    "page_end": 3,
    "source_number": 17,
    "source_section": "Computer Science"
  },
  "subject_guess": "Operating Systems",
  "subtopic_guess": "Deadlock",
  "type_guess": "MCQ",
  "marks_guess": 2,
  "stem": "...",
  "options": ["...", "...", "...", "..."],
  "answer_guess": ["C"],
  "nat_guess": null,
  "solution_guess": "...",
  "confidence": {
    "subject": 0.94,
    "subtopic": 0.81,
    "type": 0.99,
    "answer": 0.99
  }
}
```

### 11.2 Canonical placed question

```json
{
  "id": "CS27-M012-Q017",
  "paper": 12,
  "number": 17,
  "subject": "Operating Systems",
  "subtopic": "Deadlock",
  "type": "MCQ",
  "marks": 1,
  "difficulty": "Medium-Hard",
  "stem": "...",
  "options": ["...", "...", "...", "..."],
  "answer": ["C"],
  "nat": null,
  "solution": "...",
  "option_explanations": ["...", "...", "...", "..."],
  "misconception": "...",
  "family": "...",
  "reasoning_pattern": "...",
  "structure_signature": "...",
  "reasoning_steps": 2,
  "references": ["uploaded/paper.pdf"],
  "verification": {
    "status": "VERIFIED",
    "method": "Parser + independent check",
    "independent_solution": "...",
    "evidence": "...",
    "reviewed_content_hash": "..."
  },
  "validation_status": "ACCEPTED",
  "assets": []
}
```

### 11.3 Manifest assignment

```json
{
  "id": "CS27-M012-Q017",
  "paper": 12,
  "number": 17,
  "source_id": "CS27-M003-Q042",
  "subject": "Operating Systems",
  "subtopic": "Deadlock",
  "requested_subtopic": "Deadlock",
  "marks": 1,
  "type": "MCQ",
  "source_text_hash": "..."
}
```

### 11.4 Placement report

```json
{
  "paper": 12,
  "status": "PASS",
  "filled": 65,
  "unfilled": 0,
  "warnings": [
    "Q17 subtopic substituted: requested CPU scheduling, used Virtual memory"
  ],
  "subject_marks": {
    "General Aptitude": 15,
    "Engineering Mathematics": 13,
    "Digital Logic": 8,
    "...": 0
  },
  "difficulty_counts": {
    "Medium": 26,
    "Medium-Hard": 29,
    "Hard": 10
  }
}
```

---

## 12. Commands and workflow

### 12.1 Reproduce the blueprint

```bash
python blueprints/make_blueprints.py
```

This rewrites `blueprints/papers.json` and `blueprints/PLANNED_COVERAGE.md`.

### 12.2 Validate

```bash
python scripts/validate.py --paper 1
python scripts/validate.py --start 1 --end 10
python scripts/validate.py --final
python scripts/validate.py --records-only --paper 1
```

Exit code 0 means PASS. Non-zero means at least one violation. Note the current
assembled bank has known schema gaps described in Section 8.4.

### 12.3 Build and publish

```bash
python scripts/build.py --paper 1 --resume
python scripts/build.py --start 1 --end 10 --resume
```

`build.py` runs validation first. It refuses to overwrite differing completed
content.

### 12.4 Accept reviewed questions

```bash
python scripts/accept_review.py \
  --questions drafts/mock002_main.json drafts/mock002_core_low.json \
  --reviews drafts/review_mock002_main.json drafts/review_mock002_core_low.json
```

### 12.5 Reports

```bash
python scripts/report.py
```

Writes `INDEX.md`, `reports/COVERAGE.md`, `reports/coverage.csv`, and
`reports/FINAL_VALIDATION_REPORT.md`.

### 12.6 Optional HTML export

```bash
python -m pip install markdown-it-py==3.0.0
python scripts/export.py --paper 1
```

### 12.7 Portal

```bash
python launch_portal.py
```

or:

```bash
python portal_server.py 8000
```

Then open http://localhost:8000.

### 12.8 Tests

```bash
python -m unittest discover -s tests -v
```

The tests use artificial fixture questions, not the real papers. They verify:

- stale review hashes fail;
- valid fixtures pass;
- numbering and marks violations fail;
- invalid syllabus and unverified records fail;
- option/answer/NAT errors fail;
- numeric reparameterization is flagged;
- structural duplicates are flagged;
- the answer key is after Q65;
- tampered keys are detected;
- missing assets and shallow reasoning fail;
- the final audit requires 6,500 records and rendered checks;
- build refuses unverified content.

---

## 13. Worked example: placing a parsed question

Suppose the upload contains:

```text
Q.1  A system uses 4-way set-associative cache ... Which set is block 37 mapped to?
(A) 1  (B) 3  (C) 5  (D) 7
```

and the answer key says `B`, solved as 2 marks.

Parser output:

```json
{
  "source_number": 1,
  "subject_guess": "Computer Organization and Architecture",
  "subtopic_guess": "Cache mapping",
  "type_guess": "MCQ",
  "marks_guess": 2,
  "options": ["1", "3", "5", "7"],
  "answer_guess": ["B"]
}
```

Target plan for Mock 010, Section B, Q36–Q65 contains 2-mark slots. Suppose a slot
`Q47` asks for `Computer Organization and Architecture` / `Cache mapping` / 2 marks.
The matcher:

1. Filters to COA, 2-mark questions.
2. Scores exact subtopic +50, exact type +10, exact difficulty +8.
3. Rejects the question if it is already used in Mock 010.
4. Rejects the question if its source reuse count is already 3.
5. Assigns it to `Q47`.
6. Writes the destination record with `id = CS27-M010-Q047`.
7. Records `source_id` and `source_text_hash` in the manifest.
8. Sorts the paper by number and renders.

If the source question was `Q.1` but the target slot is `Q47`, the target ID and
target order win. The original source number is provenance only.

---

## 14. Common pitfalls and rules of thumb

1. **Do not append questions to a list and call it a paper.** The 65-slot contract is
   the source of truth.
2. **Do not infer marks from the source number alone.** Map to the target slot. In
   this project, marks are positional: Q1–Q5 and Q11–Q35 are 1 mark; Q6–Q10 and
   Q36–Q65 are 2 marks.
3. **Do not sort Section B by subject.** The plan intentionally interleaves
   Engineering Mathematics and core subjects.
4. **Do not assume the blueprint type is final.** Type is advisory; the bank may
   change it.
5. **Do not assume the blueprint subtopic is final.** Subtopics may change within the
   same subject. Record the difference in the manifest.
6. **Do not duplicate a source within one paper.** The within-paper uniqueness rule is
   strict.
7. **Do not exceed the reuse cap.** The series policy allows at most three occurrences
   of a source across all 100 papers.
8. **Do not fabricate answers or explanations.** If the answer key is missing, mark
   the question unverified.
9. **Do not mix adaptation answers with source answers.** Complement mappings are
   different.
10. **Do not trust the current `reports/validation.json`.** It is stale.
11. **Do not assume the current bank is fully accepted.** Only 65 records are.
12. **Preserve provenance.** The manifest is what lets you audit, re-review, and
    repair a paper later.
13. **Normalize encoding carefully.** The repository's Markdown files show mojibake
    such as `�?"` in some shells because of Windows code-page display; the underlying
    files are UTF-8 with BOM in places. Read with `utf-8-sig` and write UTF-8.
14. **Keep code blocks intact.** A code question can be destroyed by whitespace
    normalization.
15. **Validate before rendering.** Never publish a paper that fails the contract.

---

## 15. Current data facts an AI should not guess

Use these exact numbers when reasoning about the current repository:

| Fact | Value |
|---|---:|
| Planned papers | 100 |
| Planned slots | 6,500 |
| Bank records | 6,500 |
| Unique bank IDs | 6,500 |
| Distinct normalized question versions | 6,150 |
| Excess exact occurrences | 350 |
| ACCEPTED / VERIFIED records | 65 |
| REVIEW_REQUIRED records | 6,435 |
| MCQ records | 2,898 |
| MSQ records | 2,113 |
| NAT records | 1,489 |
| GA instances | 1,000 |
| Engineering Mathematics instances | 900 |
| Core CS instances | 4,600 |
| Manifest assignments | 6,500 |
| Manifest subtopic substitutions | 232 |
| Manifest blueprint-vs-actual type differences | 4,109 |
| Round-1 variants | 1,000 |
| Round-2 variants | 1,000 |
| Round-3 variants | 1,000 |
| Round-4 variants | 800 |

Paper-level facts:

- Every paper has 65 records and 100 marks in the current bank.
- Every paper has ten GA records.
- Every paper has nine Engineering Mathematics records.
- Every paper has 46 core CS records.
- The published Markdown papers all have 65 question sections, 65 solution sections,
  and a 65-row answer key.
- The full strict validation engine is not currently green on the whole bank because
  of missing review fields and null metadata.

---

## 16. Glossary

- **Blueprint / plan:** the 65-slot specification for one paper.
- **Slot:** a numbered position with subject, subtopic, marks, difficulty, and type
  targets.
- **Bank:** `data/questions.jsonl`, the canonical question records.
- **Destination:** the target `(paper, number)`.
- **Source:** the question/version used to fill a destination.
- **Manifest:** `data/assembly_manifest.json`, the destination-to-source mapping.
- **Accepted:** a question with `validation_status == "ACCEPTED"`.
- **Verified:** a question with `verification.status == "VERIFIED"` and a matching
  content hash.
- **Variant:** an adapted version (`X`, `Y`, `Z`, `W`) of an earlier question.
- **Section A:** Q1–Q10, General Aptitude.
- **Section B:** Q11–Q65, core CS and Engineering Mathematics.
- **MCQ:** multiple choice, exactly one correct option.
- **MSQ:** multiple select, multiple correct options, all-or-nothing scoring.
- **NAT:** numerical answer type, no options, accepted numeric range.
- **Review hash:** SHA-256 over the question's content, binding a review to the exact
  text.
- **Slot-first placement:** choose the target slot first, then find a question that
  satisfies it; do not simply append questions.

---

## 17. Minimal implementation checklist

If you are building the parser now, implement these in order:

- [ ] Load `blueprints/syllabus.json` and `blueprints/config.json`.
- [ ] Load or generate the 100-paper slot plan.
- [ ] Implement PDF/DOCX/image ingestion.
- [ ] Implement question/option/code/table segmentation.
- [ ] Implement field extraction with confidence and provenance.
- [ ] Implement subject/subtopic classification against the exact syllabus.
- [ ] Implement normalization for MCQ/MSQ/NAT.
- [ ] Implement the canonical question record schema.
- [ ] Implement hard and soft matching scores.
- [ ] Implement deterministic greedy + backtracking assignment.
- [ ] Implement series-level reuse and duplicate tracking.
- [ ] Implement the 65-slot validation contract.
- [ ] Implement Markdown rendering identical to `scripts/common.py`.
- [ ] Write a manifest for every placement.
- [ ] Add a review queue for low-confidence or missing-answer questions.
- [ ] Add a dry-run mode that reports unfilled slots without writing files.
- [ ] Add regression tests using the fixture style in `tests/test_engine.py`.

That is the complete process this repository uses, reduced to a form that any AI model
or developer can follow to build a reliable drag-and-drop question-paper parser and
mock-test placement engine.
