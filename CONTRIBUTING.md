# Contributing to SarkariPrep

Thank you for helping remove the paywall from Indian government exam preparation!

## Ways to Contribute
1. **Contribute Official / Memory-Based Question Papers:**
   - Use the in-app **"Upload & Convert" Studio** to upload official PDFs, DOCX files, or Markdown papers.
   - Or submit a direct PR adding structured papers following `/docs/contributing-papers.md`.
2. **Verify Questions in the Moderation Queue:**
   - Review low-confidence OCR extractions (`sourceConfidence < 0.85`) side-by-side against the original scan.
3. **Code Contributions:**
   - Run `docker compose -f docker-compose.dev.yml up -d` to spin up PostgreSQL, Redis, and MinIO.
   - Run `npm install && npm run db:migrate && npm run db:seed`.
   - Run `npm run dev` to start the Next.js frontend and NestJS API.

## Content Policy (Strict Anti-Piracy)
We **only** accept:
- Official question papers and answer keys published by conducting bodies (UPSC, SSC, IBPS, RRB, State PSCs, CBSE).
- Publicly circulated memory-based reconstructions where the contributor attests right to share.
- Original community-authored mock questions and explanations.
**Never** upload copyrighted material from paid coaching test series.
