# SarkariPrep (working name) — Open Source Government Exam Preparation Platform

> **Read this entire document before writing any code.** This README is the single source of truth for an AI coding agent (or human developer) to plan, architect, and build this project end-to-end. It defines the mission, scope, architecture, data models, feature specs, and a phased execution roadmap. Where a decision is left open, a recommendation is given — follow it unless the user says otherwise.

---

## 1. Mission & Context

Millions of Indian students preparing for government jobs (UPSC, SSC, Banking, Railways, State PSCs, Police, Defence, Teaching exams like CTET/TET, etc.) pay large sums (₹20,000–₹2,00,000+) to offline/online coaching centres for something that is fundamentally **publicly available information plus good software**: previous year question papers, mock tests, and structured preparation guides.

This project exists to **remove the paywall**. It is:
- **100% free** for end users, forever.
- **100% open source** (recommended license: **AGPL-3.0**, so that hosted forks must also stay open — protects against a company cloning it and closing the source. If the goal is maximum adoption/remixing instead, MIT is the alternative — flag this choice to the user early, don't assume).
- **Community-driven** — papers and content are crowdsourced/consolidated from what's already public, not pirated from paid sources.
- **India-first but language-aware** — many exams (SSC, Railways, State PSCs) have regional language question papers (Hindi, Bengali, Tamil, Telugu, Marathi, etc.).

### What this is NOT
- Not a coaching business. No ads that feel predatory, no "freemium" paywalls on core features (timed mocks, analytics, papers). Monetization, if ever added, should be opt-in donations/sponsorships only, decided later by the project maintainers — do not bake payment gates into the architecture.
- Not a content piracy operation. Only ingest papers that are (a) released officially by the conducting body (UPSC, SSC, IBPS, RRB, State PSCs all publish official papers/answer keys), or (b) reconstructed from public memory-based sets that are already freely circulated, or (c) user-uploaded content the uploader attests they have the right to share. Build a **takedown/reporting mechanism** from day one.

---

## 2. Core Product Pillars

1. **Exam Directory** — A structured, browsable, searchable catalog of every major Indian government exam (central + state), with metadata: conducting body, eligibility, exam pattern, syllabus, official notification links, important dates.
2. **Previous Year Papers (PYQs)** — Organized by exam → year → shift/set, available both as downloadable source files and as **take-it-like-the-real-thing mock tests**.
3. **Mock Tests** — Full-length and sectional, timed, auto-graded, exam-pattern-accurate (negative marking rules, sectional timing where applicable e.g. SSC CGL Tier I vs IBPS PO Prelims).
4. **"Upload & Convert" Engine** — The flagship differentiator: a user/admin uploads a raw question paper (PDF, DOCX, or Markdown), and the system **parses it into a structured, interactive exam** automatically — no manual data entry required to scale content.
5. **Exam-Simulation Test Player** — A full-screen, distraction-minimized, timed test-taking interface with anti-cheating safeguards, built to feel like (or better than) the real computer-based test (CBT) interface candidates see on exam day.
6. **Performance Analytics** — Post-test and longitudinal dashboards: topic/subject-wise accuracy, speed, percentile vs. other users, strong/weak area identification, revision recommendations.
7. **Preparation Guides** — Structured study plans, subject-wise notes/strategy, syllabus breakdowns, curated free resources (YouTube, NCERT, standard booklists) per exam.
8. **Community Contribution Layer** — Any user can contribute papers, report errors, suggest answer key corrections (crowdsourced moderation, like Wikipedia/Stack Overflow trust levels).

---

## 3. Target Users & Personas

| Persona | Need |
|---|---|
| **Aspirant (primary)** | Practice real + mock papers under timed, realistic conditions; track weak areas; free access regardless of financial background. |
| **Repeat Aspirant** | Compare performance across months/years, see improvement trends. |
| **Contributor** | Upload a paper they have (physical/PDF), see it instantly become a usable mock test for others. |
| **Moderator/Admin** | Approve/reject contributed content, fix OCR/parsing errors, manage exam metadata. |
| **Anonymous Visitor** | Browse exams/papers without an account; account only required to save attempts/analytics (support guest mode with local-storage-based temporary attempts too). |

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Web, PWA)                        │
│  React/Next.js SPA + Service Worker (offline mock attempts)      │
└───────────────┬─────────────────────────────┬────────────────────┘
                │ REST/GraphQL                  │ WebSocket (live test
                │                                │ session heartbeat,
                ▼                                │ anti-cheat events)
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / BACKEND                       │
│   Node.js (NestJS) or Python (FastAPI) — pick ONE, see §6        │
│   - Auth service        - Exam/Paper CRUD service                │
│   - Test session engine - Analytics engine                       │
│   - Parsing orchestrator (queues jobs to Parsing Worker)          │
└───────┬───────────────┬───────────────┬───────────────┬──────────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
┌───────────────┐ ┌───────────┐ ┌──────────────────┐ ┌─────────────┐
│ PostgreSQL     │ │ Redis      │ │ Object Storage    │ │ Parsing     │
│ (primary DB)   │ │ (sessions, │ │ (S3-compatible:   │ │ Worker Pool │
│                │ │ queues,    │ │  MinIO/R2/S3)      │ │ (async job  │
│                │ │ rate-limit)│ │  raw uploaded files,│ │  queue:     │
│                │ │            │ │  generated assets) │ │  BullMQ/    │
│                │ │            │ │                    │ │  Celery)    │
└───────────────┘ └───────────┘ └──────────────────┘ └─────────────┘
```

**Deployment target:** fully self-hostable via Docker Compose for contributors, with a reference free-tier deployment (e.g., frontend on Vercel/Netlify/Cloudflare Pages, backend on Railway/Render/Fly.io, DB on Supabase/Neon free tier, object storage on Cloudflare R2 free tier) documented in `/docs/deployment.md`.

---

## 5. Recommended Tech Stack

> These are strong defaults chosen for: (a) free-tier friendliness, (b) large contributor pool (open source needs easy onboarding), (c) good fit for the parsing/anti-cheat requirements. An agent building this should follow these unless there's a compelling reason to deviate — and if deviating, document why in `/docs/decisions/`.

### Frontend
- **Next.js 14+ (App Router) + TypeScript** — SSR for SEO on exam/paper listing pages (huge for organic discovery — "SSC CGL 2023 previous year paper" should rank on Google), CSR for the interactive test player.
- **Tailwind CSS** + **shadcn/ui** for a clean, consistent, accessible component system — fast to theme, easy for contributors to extend.
- **Zustand** or **Redux Toolkit** for test-session state (timer, answers, flags) — needs to be robust against accidental refresh/navigation.
- **Framer Motion** for subtle, purposeful motion (not decoration-for-its-own-sake).
- **React Query (TanStack Query)** for server-state/caching.
- **next-pwa** for offline capability — a student with patchy internet should be able to load a mock test once and attempt it offline, syncing results when back online.
- **next-intl** or **i18next** for multi-language UI (Hindi at minimum alongside English at launch).
- **Recharts** or **Chart.js** for analytics dashboards.

### Backend
- **NestJS (Node.js + TypeScript)** — recommended over FastAPI for this project *unless* the parsing pipeline ends up needing heavy Python NLP/OCR libraries, in which case run a **polyglot setup**: NestJS for the main API + a separate **Python FastAPI microservice** dedicated purely to document parsing (this is actually the recommended approach — see §8, parsing benefits enormously from Python's document/OCR ecosystem).
- **PostgreSQL** as primary DB — relational integrity matters here (exams → papers → sections → questions → options, user attempts → answers, all deeply relational).
- **Prisma** (if Node) as ORM — excellent DX, type-safe, easy migrations for contributors.
- **Redis** — session/timer state during live tests, job queues, rate limiting, leaderboard caching.
- **BullMQ** (Node) or **Celery** (Python) for the async parsing job queue — paper parsing must NOT block the request thread; it's upload → queue → background parse → webhook/poll for status.
- **S3-compatible object storage** (MinIO for self-hosting, Cloudflare R2 for the free-tier reference deploy) — store raw uploaded files + generated structured JSON + any extracted images (diagrams, maps in GS papers).

### Parsing Microservice (Python)
- **PyMuPDF (fitz)** or **pdfplumber** for native-text PDF extraction.
- **Tesseract OCR** (via `pytesseract`) + **pdf2image** for scanned/image-based PDFs (very common — many real exam papers are scanned).
- **python-docx** for Word files.
- **markdown-it-py** for Markdown input.
- An **LLM-assisted structuring pass** (this is the key innovation): after raw text extraction, send the raw text to an LLM (configurable — support Claude API, OpenAI, or a local model via Ollama, so the project isn't locked to one paid API) with a strict prompt to output structured JSON: question text, options, correct answer (if answer key present), subject/topic tag, marks, negative marking. See §8 for the full pipeline and prompt design.
- Expose this as an internal REST API the main backend calls: `POST /parse` → returns job ID → `GET /parse/:jobId` for status/result.

### Auth
- **Auth.js (NextAuth)** or a dedicated **Lucia Auth** / self-rolled JWT + refresh-token system. Support:
  - Email/password
  - Google OAuth (most Indian students already have Gmail)
  - Guest/anonymous mode with upgrade-to-account path (don't force signup to try a mock test — huge conversion killer).

### Infra / DevOps
- **Docker + Docker Compose** for local dev and self-hosting (this is non-negotiable for an open-source project — contributors must be able to `docker compose up` and have everything running).
- **GitHub Actions** for CI (lint, typecheck, test, build) and CD (auto-deploy on merge to main for the reference instance).
- **Sentry** (self-hostable or free tier) for error tracking.
- **Plausible** or **Umami** (privacy-respecting, self-hostable) for analytics — not Google Analytics, given the audience includes privacy-conscious students and the project's ethos.

---

## 6. Monorepo Structure

Use a monorepo (Turborepo recommended) so frontend, backend, and parsing service share types and can be developed together.

```
/
├── apps/
│   ├── web/                 # Next.js frontend
│   ├── api/                 # NestJS backend
│   └── parser/               # Python FastAPI parsing microservice
├── packages/
│   ├── shared-types/         # TypeScript types shared between web & api
│   ├── ui/                   # Shared component library (shadcn-based)
│   └── config/                # Shared eslint/prettier/tsconfig
├── docs/
│   ├── architecture.md
│   ├── deployment.md
│   ├── contributing.md
│   ├── data-model.md
│   └── decisions/             # ADRs (architecture decision records)
├── docker-compose.yml
├── docker-compose.dev.yml
├── .github/workflows/
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE
└── README.md                  # Points to this doc / public-facing version
```

---

## 7. Data Model (Core Entities)

Design this in PostgreSQL via Prisma schema (or equivalent). Key entities:

```
Organization        (e.g., "SSC", "UPSC", "IBPS", "RRB", "State PSC - WBPSC")
  └─ Exam            (e.g., "SSC CGL", "SSC CHSL" — belongs to Organization)
       ├─ ExamCycle   (e.g., "SSC CGL 2024" — a specific year's recruitment cycle;
       │               holds notification dates, eligibility, syllabus link)
       ├─ Syllabus     (structured topic tree per subject)
       ├─ PrepGuide    (markdown/rich content, study plan, booklist, strategy)
       └─ Paper         (an actual question paper instance)
            ├─ metadata: year, shift, set/series, language, source (official/
            │             memory-based/user-uploaded), verification status
            ├─ Section[]  (e.g., "Quantitative Aptitude", "General Awareness" —
            │              each with its own time limit if sectional timing applies)
            │     └─ Question[]
            │           ├─ text (rich text — may include images/tables/LaTeX for maths)
            │           ├─ options[] (for MCQ; support single/multi-select)
            │           ├─ correctAnswer
            │           ├─ explanation (optional, community-contributable)
            │           ├─ topic/subtopic tags
            │           ├─ difficulty (derived or tagged)
            │           ├─ marks, negativeMarks
            │           └─ sourceConfidence (how reliable is the parsed data —
            │                                 flagged for human review if low)
            └─ AnswerKey (official, if released separately from paper)

User
  ├─ Profile (target exams, preferred language, etc.)
  ├─ Attempt            (one instance of taking a Paper as a mock test)
  │     ├─ startedAt, submittedAt, timeTakenPerQuestion[]
  │     ├─ Response[]    (per question: selected answer, time spent, flagged-for-review,
  │     │                 changed-answer-count — useful for behavior analytics)
  │     ├─ score, sectionalScores, percentile (computed vs other Attempts on same Paper)
  │     └─ proctorEvents[]  (anti-cheat log: tab-switches, fullscreen-exits, paste-attempts,
  │                          copy-attempts, right-click attempts, devtools-open-detection,
  │                          each with timestamp — NEVER used to auto-fail the user on this
  │                          free platform, only shown as a "test integrity note" to the user
  │                          themselves, since there is no real invigilator/stakes here)
  └─ ContributionLog     (uploaded papers, moderation actions — reputation system)

AnalyticsSnapshot (materialized/aggregated per user per subject/topic, recomputed
                    periodically — don't compute this live on every dashboard load)
```

Document this fully and precisely as a Prisma schema (`schema.prisma`) in `/apps/api/prisma/schema.prisma` as one of the first implementation steps — get this right early since everything else depends on it.

---

## 8. The Upload-to-Mock-Test Parsing Pipeline (Flagship Feature)

This is the hardest and most valuable part of the system. Break it into explicit stages:

### Stage 1 — Ingestion
- User/admin uploads a file (PDF, DOCX, or MD) via the frontend, with minimal required metadata upfront (exam, year — can be edited after parsing).
- File goes to object storage; a `ParsingJob` record is created with status `queued`.
- Job pushed to the queue (BullMQ/Celery), processed by the Parser microservice asynchronously. Frontend shows a progress UI (polling or WebSocket) — "Extracting text... Identifying questions... Structuring options... Done."

### Stage 2 — Raw Extraction
- **PDF (native text):** extract text + layout (column detection matters — many papers are 2-column).
- **PDF (scanned/image):** render pages to images → OCR via Tesseract (consider `pytesseract` with Hindi/regional language trained data packs for vernacular papers) → raw text with position metadata.
- **DOCX:** parse via python-docx, preserving paragraph/table structure.
- **MD:** parse directly (simplest path — document in `/docs/contributing-papers.md` a recommended Markdown question format so power-contributors can skip OCR entirely).

### Stage 3 — Structuring (the hard part)
- Raw extracted text is messy (page numbers, headers/footers, instructions block, question numbers in varied formats "Q1.", "1)", "(1)").
- Approach: a **rule-based pre-segmenter** (regex/heuristics to split into question blocks based on numbering patterns) feeding into an **LLM structuring pass** that converts each candidate block into strict JSON matching the `Question` schema (question text, options A–D/E, detected correct answer if an answer key section exists in the same doc, subject guess, marks).
  - Make the LLM provider **pluggable** (an interface `IQuestionStructurer` with implementations for Anthropic API, OpenAI API, and a local Ollama model) — critical for an open-source project so self-hosters aren't forced into a paid API dependency. Document the recommended prompt template in `/apps/parser/prompts/structure_questions.md`.
  - Validate LLM output against a strict JSON schema (use `pydantic` in Python) and reject/retry on malformed output.
- Output: a `ParsedPaperDraft` — structured but marked `needs_review: true` by default.

### Stage 4 — Human Review Queue
- Low-confidence or newly-uploaded papers enter a **review queue** visible to moderators (and optionally the original uploader): a side-by-side UI showing the original PDF page image next to the parsed question, so a human can quickly confirm/correct in seconds rather than retyping from scratch.
- Once approved (either by a trusted moderator, or via a community-voting threshold for trusted contributors), the paper flips to `published` and becomes available as a mock test.

### Stage 5 — Publish
- Published paper is indexed, searchable, and instantly playable via the Test Player (§9).

**Important:** Build Stage 3/4 so the system is honest about uncertainty — never silently publish a possibly-wrong answer key as ground truth. Show a confidence indicator and allow every user to flag a specific question as "answer looks wrong" directly from the test review screen, feeding back into the moderation queue.

---

## 9. Test-Taking Experience (Exam Simulation Player)

This needs to feel **as good as or better than** the official CBT interfaces (SSC/IBPS/RRB candidates are used to a specific look: question palette on the right showing answered/not-answered/marked-for-review status, a running timer, section tabs). Build toward that familiarity while making it visually cleaner.

### Must-have features
- **Full-screen immersive mode** on test start (request Fullscreen API).
- **Question palette**: grid of question numbers color-coded (not visited / not answered / answered / marked for review / answered & marked for review) — exactly like real CBT exams, since familiarity reduces exam-day anxiety.
- **Section-wise navigation** with independent timers where the real exam has sectional time limits (e.g., some banking exams).
- **Global + per-section countdown timer**, auto-submit on expiry.
- **Mark for review**, **clear response**, **save & next** actions.
- **Negative marking** applied exactly per the exam's real rules (configurable per Paper — store `marks` and `negativeMarks` per question/paper).
- **Calculator/rough-sheet widget** (on-screen, since real centres often disallow physical devices but allow on-screen calculators for some exams — make this configurable per exam).
- **Resilience**: periodic autosave of responses to backend (every answer change, debounced) + local storage backup, so a browser crash/refresh doesn't lose progress. Resume-in-progress-attempt on reload.
- **Post-submit instant results**: score, sectional breakdown, correct/incorrect/unattempted counts, time-per-question heatmap, comparison to average/percentile of all other attempts on this paper.

### Anti-cheat (proportionate, not adversarial)
Be explicit with the user about *why* this exists: it's not about punishing them (there's no real stake/certificate), it's to **train exam-day discipline** and give an honest self-assessment (if they Google answers mid-test, their analytics become useless to them). Frame all anti-cheat messaging this way in the UI copy.

Implement, all client-side with event logging to backend:
- Tab-switch / window-blur detection → pause timer or just log + warn (configurable; recommend: log + gentle warning toast, don't auto-submit, since punitive auto-fail creates a bad user experience for a free self-improvement tool).
- Fullscreen-exit detection → re-prompt to re-enter fullscreen.
- Disable copy/paste and right-click within the question area (deterrent, not foolproof — be honest in docs that this is a training aid, not a secure proctoring system).
- Optional (opt-in, NOT default-on) webcam-based presence check for users who specifically want strict simulation — this is privacy-sensitive, must never upload video/images anywhere, process entirely client-side (e.g., via a lightweight face-detection model in-browser) if implemented at all. Treat this as a **Phase 3+ nice-to-have**, not core scope, and document the privacy approach clearly before building it.
- DevTools-open heuristic detection (best-effort only).
- All these events are logged to `proctorEvents` purely for the user's own post-test "integrity report" — never used to lock accounts or shame users publicly.

---

## 10. Analytics & Insights

- **Per-attempt report**: accuracy, speed, sectional strengths/weaknesses, question-by-question review with explanations.
- **Longitudinal dashboard**: trend lines across all attempts for a given exam (score over time), topic-mastery radar chart, "most improved" and "needs work" topic callouts.
- **Peer comparison**: percentile within all users who attempted the same paper (anonymized, opt-in for appearing on any public leaderboard).
- **Smart recommendations**: "You're consistently losing marks in [topic] — here are papers/guide sections focused on it" (simple rule-based recommender initially; can evolve to ML-based later — don't over-engineer this in v1).

---

## 11. Content Scope — Exams to Cover (Phase 1 priority list)

Build the Exam/Organization taxonomy to accommodate all of these, but don't block launch on having papers for every single one — launch with strong coverage of the highest-demand exams and grow via community contribution.

**Tier 1 (launch priority — highest aspirant volume):**
- SSC: CGL, CHSL, MTS, GD Constable, CPO, Stenographer, JE
- Banking: IBPS PO, IBPS Clerk, IBPS RRB (Officer & Office Assistant), SBI PO, SBI Clerk, RBI Grade B/Assistant
- Railways (RRB): NTPC, Group D, ALP, JE
- UPSC: Civil Services (Prelims GS + CSAT), CDS, NDA, CAPF
- Defence: Agniveer (Army/Navy/Airforce)
- Teaching: CTET, state TETs
- State PSCs: start with 3–5 highest-volume states (UP, Bihar, MP, Rajasthan, WB) and architect the schema so any state can be added without code changes (data-driven, not hardcoded).

**Tier 2 (post-launch expansion):** Insurance (LIC/NIACL), State Police Constable/SI exams across more states, Judiciary exams, PSU recruitment (via GATE and direct), Agriculture/forestry services, Postal/GDS, remaining State PSCs.

Store this taxonomy as seed data (`/apps/api/prisma/seed.ts` or a `/data/exams-seed.json`) rather than hardcoding in application logic, so adding a new exam is a data operation, not a code change.

---

## 12. Non-Functional Requirements

- **Accessibility**: WCAG 2.1 AA minimum — screen-reader friendly, keyboard-navigable test player (many aspirants use low-end devices; also a baseline matter of inclusivity).
- **Performance on low-end devices/slow networks**: This audience often uses budget Android phones and patchy mobile data. Aggressively optimize bundle size, lazy-load, support offline-first mock attempts (service worker caches the paper once downloaded).
- **Mobile-first responsive design**: majority of traffic will be mobile. The test player must work excellently on a phone screen, not just desktop.
- **i18n**: UI in English + Hindi at minimum for launch; architecture should make adding more Indian languages straightforward (externalized strings, not hardcoded).
- **SEO**: Exam and paper listing pages must be SSR'd and well-structured (schema.org markup for educational content) — organic search is the primary free user-acquisition channel for a no-budget open-source project.
- **Privacy**: minimal data collection, clear privacy policy, no selling/sharing user data, self-hostable so institutions/individuals can run fully private instances.
- **Scalability**: design for "lakhs" (hundreds of thousands) of concurrent users during peak exam-season traffic spikes — stateless API servers behind a load balancer, Redis for session/timer state (not in-memory on a single server), CDN for static assets and paper files.

---

## 13. Open Source Project Hygiene

Set these up from commit #1:
- `LICENSE` — AGPL-3.0 (recommended) or MIT (alternative) — **flag this choice back to the user for final confirmation before publishing**, don't silently pick.
- `CONTRIBUTING.md` — how to set up locally (`docker compose up`), coding standards, PR process, how to contribute a paper (both via the UI uploader and via direct data PR for power contributors).
- `CODE_OF_CONDUCT.md` — standard Contributor Covenant.
- Issue templates: bug report, feature request, **"Add an exam"**, **"Report incorrect answer/question"**.
- `/docs/architecture.md` — expand on this README with diagrams (use Mermaid, renders natively on GitHub).
- GitHub Discussions enabled for Q&A/roadmap debate.
- A public roadmap (GitHub Projects board) so contributors can see what's needed and claim tasks.

---

## 14. Build Roadmap (Phased)

### Phase 0 — Foundation (Week 1–2)
- Monorepo scaffold, Docker Compose dev environment, CI pipeline.
- Prisma schema for core entities (§7), migrations, seed data for exam taxonomy (§11).
- Auth (email/password + Google OAuth + guest mode).
- Basic design system setup (Tailwind + shadcn, color/typography tokens — see note below on frontend quality).

### Phase 1 — Content Browse & Static Papers (Week 3–5)
- Exam directory (browse/search/filter by organization, exam, year).
- Paper detail pages with SSR for SEO.
- Manually-seeded set of ~20–30 papers (highest-demand exams) as structured data, to validate the data model and UI before the parser exists.
- Prep guide pages (static/markdown-driven content per exam).

### Phase 2 — Test Player MVP (Week 5–7)
- Full test-taking flow: timer, question palette, navigation, autosave, submit, instant scoring.
- Basic results page (score, correct/incorrect, time taken).
- No anti-cheat yet — ship the core loop first.

### Phase 3 — Upload & Parsing Pipeline (Week 7–11)
- Parser microservice: extraction (PDF/DOCX/MD) → LLM structuring → review queue UI → publish flow.
- This is the highest-complexity phase — budget the most time here, and build it with a human-in-the-loop review step from day one rather than trying to achieve fully-automated perfect parsing immediately.

### Phase 4 — Analytics & Anti-Cheat (Week 11–13)
- Attempt history, longitudinal dashboards, topic-wise analytics.
- Anti-cheat event logging + post-test integrity report (client-side detections from §9).

### Phase 5 — Community & Polish (Week 13+)
- Contribution reputation system, moderation tools, error-reporting on questions.
- i18n rollout (Hindi UI).
- PWA/offline support.
- Accessibility audit.
- Performance optimization pass for low-end devices.

**Instruction to the building AI agent:** Don't try to build all phases in one pass. Complete Phase 0 and get a working `docker compose up` with a seeded database and a browsable (even if empty-ish) site before writing a line of parser code. Validate the data model with real seed data early — it's the foundation everything else depends on, and it's expensive to migrate later.

---

## 15. Frontend Design Direction

The user explicitly wants this "very intuitive and good looking" — do not ship generic, templated-looking UI. Concretely:
- Pick a distinctive, purposeful color palette and typography pairing — not default shadcn gray/slate-on-white. Something that feels trustworthy, calm, and focused (this is a studying tool — avoid loud/gamified visual noise that could feel juvenile or distracting; but also avoid sterile government-portal aesthetics, which is the exact opposite of what makes students trust a modern product over old coaching-center materials).
- The test-player screen in particular should feel *calm and focused* — minimal chrome, generous whitespace, a timer that's visible but not anxiety-inducing, a clean distinction between the question area and the palette/navigation.
- Dashboard/analytics screens should make data genuinely easy to read at a glance — favor well-labeled charts over dense tables, use color meaningfully (not decoratively) for strong/weak topic indicators.
- Support dark mode — students study at odd hours.
- Use the project's `frontend-design` conventions if building inside this environment; otherwise, the agent building this should explicitly design a small design-token system (colors, spacing, type scale) before building screens, rather than defaulting to unstyled or default-themed components.

---

## 16. Open Questions for the Human (Do Not Silently Assume)

An agent picking this up should surface these back to the user early rather than guessing:
1. Final license choice: AGPL-3.0 vs MIT.
2. Final project name/branding (this README uses a placeholder).
3. Whether to support an opt-in webcam-based strict-simulation mode at all, given the privacy sensitivity (§9) — recommend deferring this decision to Phase 5+.
4. Which LLM provider(s) to wire up by default for the parsing pipeline, and who bears that API cost for the public reference deployment (vs. self-hosters using their own key/local model).
5. Hosting budget for the public reference instance (affects choice of "free tier forever" infra vs. needing sponsorship/donations).

---

## 17. Summary for the Building Agent

Build this in the order of §14. Get the data model right first (§7). Treat the parsing pipeline (§8) as the hardest problem and budget accordingly — ship it with human review in the loop rather than chasing full automation. Keep anti-cheat (§9) proportionate and transparently framed as a self-discipline training feature, not surveillance. Make the frontend genuinely well-designed, not default-templated (§15). Keep the entire stack self-hostable via Docker Compose and the license copyleft-by-default, because the mission is explicitly to deny any future for-profit entity the ability to close this off and start charging the students it was built to serve for free.
