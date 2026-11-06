# ADR 001: Polyglot Backend (NestJS + Python FastAPI) & AGPL-3.0 Default License

## Context
SarkariPrep requires both high-concurrency relational API endpoints for live mock tests and heavy document/OCR processing for converting Indian exam PDFs (often two-column, bilingual, or scanned) into structured JSON.

## Decision
1. **Polyglot Architecture:** Use **NestJS (TypeScript + Prisma)** for the main API Gateway and **Python (FastAPI + PyMuPDF + Tesseract + Pydantic)** for the asynchronous parsing microservice.
2. **Pluggable LLM Structurer:** Implement `IQuestionStructurer` supporting local **Ollama**, **Anthropic Claude**, **OpenAI**, and a deterministic **Regex/Heuristic Structurer** so self-hosters never face a mandatory paid API wall.
3. **Default License:** Default to **AGPL-3.0** to protect against commercial coaching platforms closing the source of hosted forks, while flagging **MIT** as an explicit maintainer option.
