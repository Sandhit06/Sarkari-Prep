# SarkariPrep — Free, Open-Source Government Exam Preparation Platform

> **100% Free Forever. Zero Paywalls. Community-Driven.**
> Empowering millions of Indian aspirants preparing for **UPSC, SSC, IBPS/SBI/RBI Banking, RRB Railways, Defence (NDA/CDS/Agniveer), Teaching (CTET/TET), and State PSCs (WBPSC, UPPSC, BPSC, MPPSC, RPSC)**.

---

## Core Product Pillars

1. **Exam Directory (`SSR + Schema.org`)** — Searchable, structured taxonomy of Central & State recruitment exams with eligibility, syllabus trees, exam patterns, and official notification links.
2. **Previous Year Question Papers (PYQs)** — Organized by Exam → Year → Shift/Set, available as both downloadable sources and live CBT simulations.
3. **Full & Sectional Mock Tests** — Exact exam-pattern negative marking (`+2/-0.50`, `+2/-0.66`, `+1/-0.25`) and independent sectional timers (e.g., IBPS PO Prelims 20-20-20 min lock).
4. **5-Stage "Upload & Convert" Engine** — Upload any raw question paper (`PDF`, `DOCX`, `Markdown`, `TXT` or image) or paste the text → OCR/Text Extraction → Rule-based Pre-segmenter + Pluggable LLM Structurer (`Ollama` / `Claude` / `OpenAI`) → Side-by-Side Human Review Queue → One-Click Transactional Publish.
5. **Authentic Exam-Simulation CBT Player** — Fullscreen immersive mode, 5-state CBT question palette (`Answered`, `Not Answered`, `Marked for Review`, `Answered & Marked`, `Not Visited`), On-Screen Scientific/Standard Calculator, Rough Scratchpad, offline `localStorage` autosave, and proportionate self-discipline Anti-Cheat training logs.
6. **Performance & Longitudinal Analytics** — Score trend lines, topic-mastery breakdowns, time-per-question efficiency analysis, peer percentiles, and smart revision recommendations.
7. **Structured Preparation Guides** — Week-by-week study plans, syllabus trackers, and 100% free public resource lists (NCERTs, standard reference books, official portals).
8. **Community Moderation & Copyright Integrity** — Wikipedia/StackOverflow-style trust levels, crowd-verified answer keys, question error reporting, and a built-in Copyright/Takedown mechanism.

---

## Quick Start (from scratch)

Everything below assumes a fresh clone on a machine with no database installed.

### 1. Prerequisites

| Tool                                                             | Minimum         | Notes                                         |
| ---------------------------------------------------------------- | --------------- | --------------------------------------------- |
| [Node.js](https://nodejs.org)                                     | 20 LTS          | Required by `engines`; npm 10 ships with it |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | latest, running | Provides PostgreSQL, Redis and the parser     |
| Git                                                              | any             |                                               |

You do **not** need to install PostgreSQL, Redis, Python or Tesseract locally when you use Docker.

### 2. Clone and configure

```bash
git clone https://github.com/sarkariprep/sarkariprep.git
cd sarkariprep
cp .env.example .env        # the defaults are fine for local development
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

### 3. Start the whole stack (recommended)

```bash
docker compose up --build -d
```

The first build downloads the Node/Python/Tesseract base layers, so it can take a few minutes. Later builds reuse the cache — `.dockerignore` keeps the build context small.

Check status and follow logs:

```bash
docker compose ps
docker compose logs -f web
```

| Service         | URL                                 |
| --------------- | ----------------------------------- |
| Web app         | http://localhost:3000               |
| API gateway     | http://localhost:4000/api/v1        |
| API health      | http://localhost:4000/api/v1/health |
| Parser health   | http://localhost:8000/health        |
| Parser API docs | http://localhost:8000/docs          |
| PostgreSQL      | `localhost:5432`                  |
| Redis           | `localhost:6379`                  |

### 4. Seed the database (first run only)

The Postgres container creates the schema from `apps/api/prisma/migrations/…/migration.sql`, but it starts empty. Load the sample exam taxonomy and papers:

```bash
docker compose exec api npm run prisma:seed
```

The seed uses upserts, so running it again is safe.

### 5. Stop or reset

```bash
docker compose down            # stop containers, keep database data
docker compose down -v         # stop and delete the database volume (fresh start)
```

After changing code, rebuild only the affected service:

```bash
docker compose up --build -d web    # or: api, parser
```

> `apps/web/Dockerfile` runs `next dev` inside the container, so the first request after a rebuild compiles the page.

---

## Upload & Convert (OCR pipeline)

The flagship ingestion flow is live end-to-end: **web converter → API gateway →
FastAPI parser → PostgreSQL**.

### From the UI

Open **http://localhost:3000 → Papers & mocks → Open the converter** (or drop a
file on the converter card).

1. Choose or drop a **PDF, DOCX, Markdown, TXT or image** (max 25 MB).
2. Paper details are **prefilled from the selected exam**: duration, positive
   marks and negative marking. Change the exam, year, shift, title or marks if
   needed — header values inside the file override the form.
3. The parser extracts text (PyMuPDF layout → per-page Tesseract OCR for scans),
   segments questions, parses options/answers and returns a confidence-scored draft.
4. Review side-by-side: fix answer keys, edit text, remove junk questions.
5. **Publish** creates the paper, section, questions and answer key in one
   transaction. It appears immediately in the papers list.

There is also a **Paste text** tab for typed papers or when OCR is poor.

### From the API

| Method    | Endpoint                            | Purpose                                       |
| --------- | ----------------------------------- | --------------------------------------------- |
| `POST`  | `/api/v1/parser/jobs`             | Multipart upload (`file` + metadata fields) |
| `POST`  | `/api/v1/parser/jobs/manual`      | Paste raw text as JSON                        |
| `GET`   | `/api/v1/parser/jobs`             | List recent parsing jobs                      |
| `GET`   | `/api/v1/parser/jobs/:id`         | Fetch the draft for review                    |
| `PATCH` | `/api/v1/parser/jobs/:id`         | Save review edits                             |
| `POST`  | `/api/v1/parser/jobs/:id/publish` | Validate + publish transactionally            |
| `GET`   | `/api/v1/health`                  | API + database + parser health                |
| `GET`   | `/api/v1/parser/health`           | Parser capability probe                       |

```bash
curl -X POST http://localhost:4000/api/v1/parser/jobs \
  -F "file=@paper.pdf" \
  -F "examSlug=ssc-cgl" \
  -F "year=2024" \
  -F "durationMinutes=60" \
  -F "positiveMarks=2" \
  -F "negativeMarks=0.5"
```

Full input rules, Markdown format and API examples: **[docs/contributing-papers.md](docs/contributing-papers.md)**.

> The parser image bundles Tesseract (`eng`, `hin`, `ben`) and Poppler. Scanned
> PDFs OCR page-by-page; text PDFs use PyMuPDF's layout extraction and skip OCR.
> The optional Ollama structurer is used when `LLM_PROVIDER=ollama` and the model
> server is reachable; otherwise the deterministic structurer is used.

---

## Local Development (hot reload)

### Web app only

The UI ships with local demo data and needs no backend:

```bash
npm install
cd apps/web
npm run dev            # http://localhost:3000
```

If the Docker stack is already running, free the port first with `docker compose stop web`.

### Full stack on the host

Run PostgreSQL and Redis in Docker, then the Node apps locally:

```bash
docker compose up -d postgres redis
docker compose stop web api      # only if the full stack is already running

npm install
npm run db:generate

# Prisma runs from apps/api and does not read the root .env
export DATABASE_URL="postgresql://sarkariprep:sarkariprep_secret@localhost:5432/sarkariprep?schema=public"
export REDIS_URL="redis://localhost:6379/0"
export JWT_SECRET="dev_jwt_secret_key"

npm run db:seed        # schema is created by the Postgres init script
npm run dev            # Next.js :3000 + NestJS :4000
```

PowerShell equivalent for the environment variables:

```powershell
$env:DATABASE_URL="postgresql://sarkariprep:sarkariprep_secret@localhost:5432/sarkariprep?schema=public"
$env:REDIS_URL="redis://localhost:6379/0"
$env:JWT_SECRET="dev_jwt_secret_key"
```

Using your own empty PostgreSQL instance instead of the compose one? Apply the schema first with `npm run db:migrate`.

### Root scripts

| Command                                 | Description                           |
| --------------------------------------- | ------------------------------------- |
| `npm run dev`                         | Web + API in watch mode (Turborepo)   |
| `npm run build`                       | Production build for every workspace  |
| `npm run typecheck`                   | TypeScript checks                     |
| `npm run db:generate`                 | Generate the Prisma client            |
| `npm run db:migrate`                  | Apply migrations to an empty database |
| `npm run db:seed`                     | Seed exams, cycles and papers         |
| `npm run docker:up` / `docker:down` | Start/stop the full Docker stack      |

### Troubleshooting

| Symptom                                          | Fix                                                                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `port is already allocated`                    | Another process owns 3000/4000/5432/6379/8000. Stop it or change the host port in `docker-compose.yml`.                                     |
| `localhost:3000` shows an old UI               | The web image is stale: `docker compose up --build -d web`.                                                                                 |
| API returns `[]`                               | Database not seeded: `docker compose exec api npm run prisma:seed`.                                                                         |
| `Environment variable not found: DATABASE_URL` | Prisma runs from `apps/api` and ignores the root `.env`; export `DATABASE_URL` first (see above) or copy `.env` to `apps/api/.env`. |
| `P3005: The database schema is not empty`      | Expected with the Docker database (schema comes from the init script). Skip `db:migrate` and just run `db:seed`.                          |
| `The document parser is unreachable`           | `docker compose ps parser`, then check `http://localhost:8000/health` and the API's `PARSER_SERVICE_URL`.                               |
| Converter returns 0 questions                    | Use `Q1.` / `1.` numbering or the Markdown format in `docs/contributing-papers.md`; try the **Paste text** tab.                   |
| OCR text is garbled                              | Use a 300 DPI scan; Tesseract languages `eng`, `hin`, `ben` are bundled in the parser image.                                            |
| Start over completely                            | `docker compose down -v && docker compose up --build -d && docker compose exec api npm run prisma:seed`.                                    |

---

## Monorepo Layout

```text
/
├── apps/
│   ├── web/                  # Next.js 14+ App Router + Tailwind + Zustand + next-intl (EN/HI)
│   ├── api/                  # NestJS + Prisma + PostgreSQL + Redis + BullMQ
│   └── parser/               # Python FastAPI + PyMuPDF + Tesseract OCR + Pluggable LLM Structurer
├── packages/
│   ├── shared-types/         # Shared TypeScript interfaces for CBT player, papers & analytics
│   ├── ui/                   # Accessible design system tokens & components
│   └── config/               # Shared ESLint, Prettier & TypeScript configs
├── data/
│   └── exams-seed.json       # Data-driven Tier 1 & Tier 2 Indian Govt Exam Taxonomy
├── docs/
│   ├── architecture.md       # System architecture & Mermaid diagrams
│   ├── data-model.md         # Entity-relationship overview
│   ├── deployment.md         # Zero/low-cost cloud deployment guide
│   ├── contributing-papers.md# Markdown specification for power contributors
│   └── decisions/            # Architecture Decision Records (ADRs)
└── docker-compose.yml
```

## Developer
<table>
    <tr align="center">
        <td>
        Sandhit Karmakar
        <p align="center">
            <img src = "https://avatars.githubusercontent.com/u/90787826?v=4" width="150" height="150" alt="Dhruv Shah">
        </p>
            <p align="center">
                <a href="https://github.com/Sandhit06">
                    <img src="https://res.cloudinary.com/dyz1paeem/image/upload/v1793130084/round-collaboration-social-github-code-circle-network-icon_rk5x5t.svg" width="36" height="36" alt="GitHub"/>
                </a>
                <a href="https://www.linkedin.com/in/sandhit-karmakar/" target="_blank">
                    <img src="https://res.cloudinary.com/dyz1paeem/image/upload/v1793130084/network-linkedin-social-connection-circular-circle-media-icon_vdou3m.svg" width="36" height="36" alt="LinkedIn"/>
                </a>
                <a href="mailto:sandhitkarmakar@gmail.com" target="_blank">
                    <img src="https://res.cloudinary.com/dyz1paeem/image/upload/v1793129062/share-send-email-chat-circle-message-mail-icon_u4rx53.svg" width="36" height="36" alt="Email"/>
                </a>
            </p>
        </td>
    </tr>
</table>

<p align="center">
    Made with ❤️ by <a href="https://github.com/Sandhit06">Sandhit Karmakar</a>
</p>
