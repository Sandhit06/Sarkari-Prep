"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Play } from "lucide-react";
import { Badge, Eyebrow, GlassCard, ProgressBar, secondaryButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getResumeState, type ResumeState } from "@/lib/session";

const DEFAULT_PAPER = "ssc-cgl-2024-t1-s1";
const DEFAULT_TITLE = "SSC CGL 2024 — Tier I, Shift 1";

function formatLeft(seconds: number) {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss} left`;
}

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Autosaved just now";
  if (minutes < 60) return `Autosaved ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `Autosaved ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export function ContinueCard() {
  const [resume, setResume] = useState<ResumeState | null>(null);

  useEffect(() => {
    setResume(getResumeState());
  }, []);

  const total = resume?.total ?? 100;
  const answered = resume?.answered ?? 0;
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
  const href = resume ? `/test/${resume.paperSlug}` : `/test/${DEFAULT_PAPER}`;

  return (
    <GlassCard className="lift flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>{resume ? "Pick up where you left off" : "Ready when you are"}</Eyebrow>
          <p className="mt-1 text-[11.5px] text-ink-500 dark:text-ink-400">
            {resume ? timeAgo(resume.updatedAt) : "Your next mock is one click away"}
          </p>
        </div>
        <Badge tone="saffron">
          <Clock3 className="h-3 w-3" aria-hidden />
          {resume ? formatLeft(resume.secondsLeft) : "60:00 left"}
        </Badge>
      </div>

      <h3 className="mt-4 font-display text-lg font-bold leading-snug tracking-[-0.015em] text-ink-900 dark:text-white">
        {resume?.paperTitle ?? DEFAULT_TITLE}
      </h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge>Official PYQ</Badge>
        <Badge tone="brand">Bilingual</Badge>
        <Badge tone="neutral">+2 / −0.50</Badge>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-[11.5px] font-semibold">
          <span className="text-ink-600 dark:text-ink-300">
            {answered} of {total} answered
          </span>
          <span className="font-mono text-ink-500 dark:text-ink-400">{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link href={href} className={cn(secondaryButton, "flex-1 px-3 py-2 text-[13px]")}>
          <Play className="h-3.5 w-3.5" aria-hidden />
          {resume ? "Resume test" : "Start a mock"}
        </Link>
        <Link
          href="#analytics"
          className="press grid h-9 w-9 place-items-center rounded-xl border border-ink-900/10 bg-white/50 text-ink-600 hover:text-ink-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-ink-300 dark:hover:text-white"
          aria-label="Open analytics"
        >
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </GlassCard>
  );
}
