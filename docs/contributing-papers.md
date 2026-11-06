# Contributing Papers (Upload, OCR & Markdown)

SarkariPrep accepts a paper three ways:

1. **Drag & drop / upload** a PDF, DOCX, Markdown, TXT or image of the paper.
2. **Paste the paper text** in the converter (no OCR needed).
3. **Submit clean Markdown** using the format below — the fastest and most accurate path.

Every route ends in the same place: a structured draft that a human reviews and
publishes. Nothing goes live automatically.

---

## 1. The converter in the web app

Open **Papers & mocks → Open the converter** (or drop a file directly on the
converter card).

### Step 1 — Paper & details

| Field | Default | Notes |
| --- | --- | --- |
| Exam / paper | SSC CGL | Loaded from `GET /api/v1/exams`; only exams in the database can be published |
| Year | Last completed year | Used in the paper title and slug |
| Paper title | `{Exam} {Year} — {Shift}` | Editable |
| Shift / tier | `Tier-I Shift 1` | e.g. `Tier-II`, `Prelims`, `Shift 2` |
| Duration | From the selected exam | Minutes |
| Marks per correct | From the selected exam (`2.0` for SSC/UPSC) | Positive marks |
| Negative per wrong | From the selected exam (`0.50` for SSC CGL) | `0` disables negative marking |

Header values inside the file (see below) **override** the form defaults, so a
paper that already says `# Year: 2023` is filed under 2023 even if the form
still shows the current year.

For GATE, select **GATE CSE** before dropping the PDF or scan. The converter
keeps the drag-and-drop flow and lets you review MCQ, MSQ and NAT questions.
GATE's mixed 1- and 2-mark scoring is per question, so check the `+` and `−`
mark fields in the review list before publishing.

### Step 2 — Review questions

The parser returns a draft with:

- extracted question text and options
- a guessed answer key (from `Ans:` lines or a separate answer-key table)
- subject/topic tags and explanations when present
- a confidence score per question

Questions below **85% confidence** are flagged. Click any option to set or fix
the answer key, use **Edit** to correct the question text, and remove questions
that are not real questions (headers, instructions, page numbers).

### Step 3 — Publish

Publishing runs in a single database transaction: it creates the `Paper`, its
`Section`, every `Question`, and the `AnswerKey`, then marks the `ParsingJob`
as `COMPLETED`. The paper appears immediately in `GET /api/v1/papers`.

---

## 2. Markdown contributor format

```markdown
# Exam: ssc-cgl
# Title: SSC CGL 2024 Tier-I Shift 1
# Year: 2024
# Shift: Tier-I Shift 1
# Set: Set A
# Duration: 60
# Marks: +2.0, -0.50
# Source: Official
# Language: en

Q1. Which Article of the Constitution of India provides for the appointment of a Finance Commission?
(A) Article 275
(B) Article 280
(C) Article 300A
(D) Article 315
Ans: B
Subject: General Awareness
Topic: Indian Polity — Constitutional Bodies
Difficulty: Moderate
Explanation: Article 280 of the Indian Constitution requires the President to constitute a Finance Commission every five years.

Q2. If the ratio of cost price to selling price of an article is 5 : 6, what is the profit percentage?
(A) 16.67%
(B) 20%
(C) 25%
(D) 15%
Ans: B
Subject: Quantitative Aptitude
Topic: Profit and Loss
Explanation: Profit % = ((6 - 5) / 5) * 100 = 20%.
```

### GATE CSE: MCQ, MSQ and NAT

Use a type and marks line on each question when a paper has mixed marks. The
parser treats GATE MSQ and NAT as having no negative marking, and applies the
one-third penalty to MCQs (so a 2-mark MCQ has a `-0.67` penalty). OCR can
misread answer keys or question types, so verify every flagged item in review.

```markdown
# Exam: gate-cse
# Title: GATE CSE practice set
# Year: 2025
# Duration: 180

Q1. Which statements about a relation in BCNF are true?
Type: MSQ
Marks: 2
(A) Every determinant is a superkey
(B) Every attribute is prime
(C) BCNF implies 3NF
(D) Every relation has exactly one candidate key
Ans: A, C
Subject: Databases
Topic: Normalization

Q2. A cache has a 2 ns hit time, a 5% miss rate and an 80 ns miss penalty. What is its AMAT?
Type: NAT
Marks: 1
Ans: 6
Tolerance: 0.01
Subject: Computer Organization and Architecture
Topic: Cache memory

Q3. What is the worst-case time complexity of binary search?
Type: MCQ
Marks: 1
(A) O(1)
(B) O(log n)
(C) O(n)
(D) O(n log n)
Ans: B
Subject: Algorithms
Topic: Searching
```

### Header fields

All header lines are optional; `#` is optional too. Keys are case-insensitive.

| Key | Example | Effect |
| --- | --- | --- |
| `Exam` / `Exam Slug` | `ssc-cgl` | Exam slug; must exist in the database |
| `Title` / `Paper` | `SSC CGL 2024 Tier-I Shift 1` | Paper title |
| `Year` | `2024` | Paper year |
| `Shift` | `Tier-I Shift 1` | Shift / tier label |
| `Set` / `Set Series` | `Set A` | Question-paper series |
| `Duration` / `Duration Minutes` | `60` or `2 hours` | Duration in minutes |
| `Marks` | `+2.0, -0.50` or `2 / -0.5` | Positive and negative marks |
| `Source` | `Official`, `Memory based`, `User uploaded` | `PaperSourceType` |
| `Language` | `en`, `hi` | Paper language |

### Question rules

- Start each question with `Q1.`, `Q2.` … or `1.`, `2.` … at the beginning of a line.
- Options can be written as `(A) text`, `A. text` or `A) text`.
- Inline options on one line are supported: `(A) 50 km/h (B) 60 km/h (C) 70 km/h (D) 80 km/h`.
- `Ans: B` (or `Answer: B`, `Correct Option: B`) sets the key. If omitted, the
  question is flagged for review and defaults to option A until corrected.
- `Subject:`, `Topic:`, `Difficulty:` and `Explanation:` are optional. Missing
  subjects are inferred from keywords (quant, reasoning, English, GK).
- Explanations may continue on the following lines until the next question.
- A separate answer key is supported:

```text
Answer Key
1 B 2 D 3 A 4 C 5 B
```

The key is matched by question number and raises confidence automatically.

---

## 3. Manual paste mode

Choose **Paste text** in the converter and paste either the Markdown format above
or plain text from a PDF. The same metadata form applies. Use this when:

- OCR produced garbled text,
- the paper is already typed in a document,
- you only have a handful of questions.

The **Use sample paper** button inserts a small working example.

---

## 4. API flow

Base URL: `http://localhost:4000/api/v1`

### Upload a file

```bash
curl -X POST http://localhost:4000/api/v1/parser/jobs \
  -F "file=@paper.pdf;type=application/pdf" \
  -F "examSlug=ssc-cgl" \
  -F "year=2024" \
  -F "title=SSC CGL 2024 Tier-I Shift 1" \
  -F "shift=Tier-I Shift 1" \
  -F "durationMinutes=60" \
  -F "positiveMarks=2" \
  -F "negativeMarks=0.5"
```

Limits: **25 MB**, one file. Accepted: `pdf`, `docx`, `md`, `markdown`, `txt`,
`png`, `jpg`, `jpeg`, `webp`, `tif`, `tiff`, `bmp`.

The response is the persisted `ParsingJob`. The draft lives in
`parsedDraftJson`:

```json
{
  "id": "cm...",
  "status": "NEEDS_REVIEW",
  "extractedQuestionCount": 100,
  "averageConfidence": 0.91,
  "parsedDraftJson": {
    "examSlug": "ssc-cgl",
    "year": 2024,
    "title": "SSC CGL 2024 Tier-I Shift 1",
    "durationMinutes": 60,
    "positiveMarks": 2,
    "negativeMarks": 0.5,
    "extractionMethod": "pymupdf_layout+tesseract_ocr",
    "warnings": [],
    "questions": [
      {
        "questionNumber": 1,
        "text": "Which Article …",
        "options": [{ "id": "A", "text": "Article 275" }],
        "correctOptionId": "B",
        "subjectTag": "General Awareness",
        "topicTag": "Indian Polity",
        "sourceConfidence": 0.94,
        "needsHumanReview": false
      }
    ]
  }
}
```

### Paste text

```bash
curl -X POST http://localhost:4000/api/v1/parser/jobs/manual \
  -H "Content-Type: application/json" \
  -d '{
    "rawText": "# Exam: ssc-cgl\n# Year: 2024\n\nQ1. …\n(A) …\n(B) …\nAns: B",
    "examSlug": "ssc-cgl",
    "year": 2024,
    "durationMinutes": 60,
    "positiveMarks": 2,
    "negativeMarks": 0.5
  }'
```

### Read, update, publish

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/parser/jobs?status=NEEDS_REVIEW&take=20` | List recent jobs |
| `GET` | `/parser/jobs/:jobId` | Full draft for review |
| `PATCH` | `/parser/jobs/:jobId` | Save edits to title/shift/marks/questions |
| `POST` | `/parser/jobs/:jobId/publish` | Validate + publish transactionally |

`PATCH` example:

```bash
curl -X PATCH http://localhost:4000/api/v1/parser/jobs/<jobId> \
  -H "Content-Type: application/json" \
  -d '{
    "title": "SSC CGL 2024 Tier-I Shift 1",
    "questions": [ … ]
  }'
```

`publish` example:

```bash
curl -X POST http://localhost:4000/api/v1/parser/jobs/<jobId>/publish \
  -H "Content-Type: application/json" \
  -d '{
    "examSlug": "ssc-cgl",
    "title": "SSC CGL 2024 Tier-I Shift 1",
    "year": 2024,
    "shift": "Tier-I Shift 1",
    "durationMinutes": 60,
    "positiveMarks": 2,
    "negativeMarks": 0.5,
    "questions": [ … reviewed questions … ]
  }'
```

Publishing fails with `400` if a question has no text, fewer than two options,
or an answer key that does not match an option. It fails with `409` if the job
was already published.

### Parser service directly

The FastAPI service is available at `http://localhost:8000`:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Capability probe (PyMuPDF, Tesseract languages, limits) |
| `POST` | `/parse` | Multipart extraction + structuring |
| `POST` | `/parse/manual` | Paste text |
| `GET` | `/parse/:jobId` | Full in-memory draft |
| `GET` | `/parse` | Recent in-memory jobs |

Interactive docs: `http://localhost:8000/docs`.

---

## 5. Confidence & review rules

| Signal | Effect |
| --- | --- |
| Answer key found | Confidence lifted to at least `0.88` |
| Missing answer | Flagged, defaults to option A |
| Fewer than 4 options | Placeholder options added, flagged |
| Very short stem | Lower confidence |
| OCR extraction | Questions may still be flagged if text is noisy |
| Separate answer-key table | Applied by question number |

The API never publishes a job twice, and the web UI only enables **Publish**
when at least one question exists.

---

## 6. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `No text could be extracted` | Use a clearer scan (300 DPI) or paste the text manually |
| 0 questions detected | Add `Q1.` / `1.` numbering, or use the Markdown format |
| Garbled Hindi/Bengali | Install/verify Tesseract language packs (`eng`, `hin`, `ben`) |
| `Unsupported file type` | Convert to PDF/DOCX/Markdown/TXT or an image |
| `File is larger than 25 MB` | Split the paper or compress the scan |
| `The document parser is unreachable` | `docker compose ps parser` and check `:8000/health` |
| `Exam "…" not found` | Use an exam slug that exists in `GET /api/v1/exams` |
| Wrong answer key | Correct it in the review step before publishing |
| Job already published (`409`) | Create a new job; published papers are immutable through this flow |
