# Reference Free-Tier & Self-Hosted Deployment Guide

## Option A: 100% Self-Hosted (Single VPS or Local Machine)
```bash
cp .env.example .env
docker compose up -d --build
```
All components (Next.js, NestJS, FastAPI + Tesseract OCR, PostgreSQL, Redis, MinIO) run inside isolated containers.

## Option B: Zero-Cost Cloud Reference Architecture
- **Frontend (`apps/web`):** Deploy to **Cloudflare Pages** or **Vercel** (Free Tier) with SSR caching on `/exams/*` and `/papers/*`.
- **Main API (`apps/api`):** Deploy to **Render** or **Fly.io** (Free/Hobby Tier).
- **Database (`PostgreSQL`):** **Neon** or **Supabase** Free Tier.
- **Redis (`Session & Queues`):** **Upstash Redis** Free Tier.
- **Object Storage:** **Cloudflare R2** (10 GB/month free, zero egress fees for question paper PDFs).
- **Parsing Worker (`apps/parser`):** Run on a contributor machine with local **Ollama (`llama3.1:8b`)** or trigger on-demand via serverless container.
