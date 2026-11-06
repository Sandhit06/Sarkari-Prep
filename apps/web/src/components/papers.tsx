"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Languages,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
  Timer,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { Badge, GlassCard, primaryButton, secondaryButton } from "@/components/ui";
import { ConverterDialog } from "@/components/converter-dialog";
import { papers, type Paper } from "@/lib/data";
import { paperCatalogCount } from "@/lib/paper-catalog";
import { cn } from "@/lib/cn";

const typeStyles: Record<Paper["type"], { tone: "brand" | "violet" | "success"; icon: LucideIcon }> = {
  "Official PYQ": { tone: "brand", icon: FileText },
  "Full mock": { tone: "violet", icon: Timer },
  "Sectional drill": { tone: "success", icon: Layers },
  "Speed test": { tone: "success", icon: Timer },
};

const steps = [
  "Drop a PDF, DOCX or Markdown paper",
  "OCR + layout extraction runs server-side",
  "Questions, options and keys are structured",
  "Review side-by-side, then publish instantly",
];

export function Papers() {
  const [converterOpen, setConverterOpen] = useState(false);
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const openConverter = (file?: File) => {
    setInitialFile(file ?? null);
    setConverterOpen(true);
  };

  const closeConverter = () => {
    setConverterOpen(false);
    setInitialFile(null);
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <GlassCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-ink-900/[0.06] px-4 py-3 dark:border-white/[0.08]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
              Recommended for you
            </p>
            <span className="font-mono text-[10.5px] text-ink-500 dark:text-ink-400">Updated today</span>
          </div>

          <ul className="divide-y divide-ink-900/[0.06] dark:divide-white/[0.07]">
            {papers.map((paper) => {
              const { tone, icon: Icon } = typeStyles[paper.type];
              return (
                <li key={paper.slug} className="group px-4 py-3.5 transition-colors hover:bg-white/40 dark:hover:bg-white/[0.03]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900/[0.045] text-ink-600 ring-1 ring-inset ring-ink-900/[0.05] dark:bg-white/[0.06] dark:text-ink-300 dark:ring-white/10">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={tone}>{paper.type}</Badge>
                        <Badge>{paper.year}</Badge>
                        {paper.bilingual ? (
                          <Badge tone="success">
                            <Languages className="h-3 w-3" aria-hidden />
                            EN / हिं
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-1.5 truncate font-display text-[13.5px] font-bold tracking-[-0.01em] text-ink-900 dark:text-white">
                        <Link href={`/test/${paper.slug}`} className="hover:text-brand-700 dark:hover:text-brand-300">
                          {paper.title}
                        </Link>
                      </h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                        <span>{paper.questions} questions</span>
                        <span aria-hidden>·</span>
                        <span>{paper.durationMins} min</span>
                        <span aria-hidden>·</span>
                        <span>{paper.marks} marks</span>
                        <span aria-hidden>·</span>
                        <span>{paper.negative > 0 ? `−${paper.negative.toFixed(2)} negative` : "No negative"}</span>
                        <span aria-hidden>·</span>
                        <span>{paper.attempts} attempts</span>
                      </p>
                    </div>

                    <Link
                      href={`/test/${paper.slug}`}
                      aria-label={`Start ${paper.title}`}
                      className={cn(secondaryButton, "mt-0.5 shrink-0 px-3 py-1.5 text-[12px]")}
                    >
                      <Play className="h-3 w-3" aria-hidden />
                      Start
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-900/[0.06] px-4 py-3 dark:border-white/[0.08]">
            <a
              href="/papers"
              className="press inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Browse all {paperCatalogCount} papers
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </a>
            <span className="font-mono text-[10px] text-ink-500 dark:text-ink-400">18 per exam</span>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-4">
          {/* Upload & convert */}
          <GlassCard className="relative overflow-hidden p-5">
            <div
              aria-hidden
              className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-saffron-400/25 blur-2xl"
            />
            <div className="relative">
              <Badge tone="saffron">
                <Sparkles className="h-3 w-3" aria-hidden />
                Flagship engine
              </Badge>
              <h3 className="mt-3 font-display text-lg font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">
                Turn any paper into a mock test
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                A five-stage pipeline with human review before anything goes live.
              </p>

              <button
                type="button"
                onClick={() => openConverter()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const dropped = event.dataTransfer.files?.[0];
                  if (dropped) openConverter(dropped);
                }}
                className={cn(
                  "mt-4 w-full rounded-2xl border border-dashed px-3 py-4 text-center transition-colors",
                  dragging
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-ink-900/15 bg-white/40 hover:border-brand-500/50 hover:bg-brand-500/[0.06] dark:border-white/15 dark:bg-white/[0.03]",
                )}
              >
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-saffron-400/15 text-saffron-600 ring-1 ring-inset ring-saffron-500/20 dark:text-saffron-300">
                  <UploadCloud className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-2 text-[12px] font-semibold text-ink-800 dark:text-ink-100">
                  {dragging ? "Drop to open the converter" : "Drop PDF, DOCX or Markdown"}
                </p>
                <p className="mt-0.5 text-[10.5px] text-ink-500 dark:text-ink-400">Max 25 MB · OCR included</p>
              </button>

              <ol className="mt-4 space-y-2">
                {steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-2 text-[11.5px] text-ink-600 dark:text-ink-300">
                    <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-500/12 font-mono text-[9px] font-bold text-brand-700 dark:bg-brand-400/15 dark:text-brand-300">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              <button
                type="button"
                onClick={() => openConverter()}
                className={cn(primaryButton, "mt-4 w-full px-4 py-2.5 text-[13px]")}
              >
                Open the converter
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </GlassCard>

          {/* Community trust */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/12 text-emerald-700 ring-1 ring-inset ring-emerald-600/15 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[12px] font-bold text-ink-900 dark:text-white">Community verified</p>
                <p className="text-[10.5px] text-ink-500 dark:text-ink-400">Every key checked by a reviewer</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex -space-x-2" aria-hidden>
                {["AK", "RS", "MB", "TN"].map((initials, index) => (
                  <span
                    key={initials}
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#0b101d]",
                      index === 0 && "bg-brand-600",
                      index === 1 && "bg-emerald-700",
                      index === 2 && "bg-violet-600",
                      index === 3 && "bg-saffron-700",
                    )}
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <p className="text-[10.5px] leading-snug text-ink-500 dark:text-ink-400">
                <span className="font-semibold text-ink-800 dark:text-ink-100">128 contributors</span> reviewed papers
                this month
              </p>
            </div>
          </GlassCard>
        </div>
      </div>

      <ConverterDialog open={converterOpen} onClose={closeConverter} initialFile={initialFile} />
    </>
  );
}
