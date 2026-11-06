#!/usr/bin/env bash
set -euo pipefail

echo "=================================================================="
echo " SarkariPrep Full-Stack Local Setup (Postgres + Redis + MinIO)"
echo "=================================================================="

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[1/5] Created .env from .env.example"
else
  echo "[1/5] Using existing .env"
fi

echo "[2/5] Starting PostgreSQL, Redis, and MinIO via Docker Compose..."
docker compose -f docker-compose.dev.yml up -d

echo "[3/5] Installing Node.js workspace dependencies..."
npm install

echo "[4/5] Running Prisma Client generation, PostgreSQL migrations & Exam/PYQ Seed..."
npm run db:generate
npm run db:migrate
npm run db:seed

echo "[5/5] Setup complete!"
echo "  -> Run 'npm run dev' to start Next.js (port 3000) and NestJS API (port 4000)"
echo "  -> Or run 'docker compose up --build' to run the entire stack including Python FastAPI Parser (port 8000)"
