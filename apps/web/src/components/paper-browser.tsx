"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  FileText,
  Layers,
  Play,
  Search,
  Sparkles,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge, GlassCard, primaryButton } from "@/components/ui";
import type { Paper, PaperType } from "@/lib/data";
import type { CatalogPaper } from "@/lib/paper-catalog";
import { cn } from "@/lib/cn";

const typeStyles: Record<PaperType, { tone: "brand" | "violet" | "success"; icon: LucideIcon }> = {
  "Official PYQ": { tone: "brand", icon: FileText },
  "Full mock": { tone: "violet", icon: Timer },
  "Sectional drill": { tone: "success", icon: Layers },
  "Speed test": { tone: "success", icon: Clock3 },
};

const typeFilters: Array<PaperType | "ALL"> = ["ALL", "Full mock", "Sectional drill", "Speed test"];

export function PaperBrowser({ papers }: { papers: CatalogPaper[] }) {
  const [query, setQuery] = useState("");
  const [examSlug, setExamSlug] = useState("ALL");
  const [type, setType] = useState<PaperType | "ALL">("ALL");
  const deferredQuery = useDeferredValue(query);

  const exams = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const paper of papers) {
      const current = counts.get(paper.examSlug);
      counts.set(paper.examSlug, {
        label: paper.examShortName,
        count: (current?.count ?? 0) + 1,
      });
    }
    return Array.from(counts, ([slug, value]) => ({ slug, ...value })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [papers]);

  const visible = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    return papers.filter((paper) => {
      const matchesExam = examSlug === "ALL" || paper.examSlug === examSlug;
      const matchesType = type === "ALL" || paper.type === type;
      const matchesQuery =
        term.length === 0 ||
        [paper.title, paper.exam, paper.examShortName, paper.type, paper.shift].some((value) =>
          value.toLowerCase().includes(term),
        );
      return matchesExam && matchesType && matchesQuery;
    });
  }, [deferredQuery, examSlug, papers, type]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <GlassCard className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
            Total papers
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900 dark:text-white">{papers.length}</p>
          <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">Every one opens as a live timed test.</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
            Exam coverage
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900 dark:text-white">{exams.length}</p>
          <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">Central, banking, railway, state and defence.</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
            Equal weightage
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900 dark:text-white">
            {exams[0]?.count ?? 0} each
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
            No exam gets buried under another.
          </p>
        </GlassCard>
      </div>

      <div className="glass rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-ink-500"
              aria-hidden
            />
            <label htmlFor="paper-search" className="sr-only">
              Search papers
            </label>
            <input
              id="paper-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search SSC CGL, WBCS, speed test, 2025…"
              className="h-10 w-full rounded-xl border border-ink-900/10 bg-white/60 pl-9 pr-9 text-[13px] font-medium text-ink-900 placeholder:text-ink-500 focus:border-brand-500/60 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-ink-400"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="press absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-ink-900/5 hover:text-ink-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>

          <label htmlFor="paper-exam" className="sr-only">
            Filter by exam
          </label>
          <select
            id="paper-exam"
            value={examSlug}
            onChange={(event) => setExamSlug(event.target.value)}
            className="h-10 rounded-xl border border-ink-900/10 bg-white/70 px-3 text-[12.5px] font-semibold text-ink-800 focus:border-brand-500/60 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
          >
            <option value="ALL">All exams ({papers.length})</option>
            {exams.map((exam) => (
              <option key={exam.slug} value={exam.slug}>
                {exam.label} ({exam.count})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by paper type">
          {typeFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              aria-pressed={type === item}
              className={cn(
                "press rounded-full px-3 py-1.5 text-[11.5px] font-semibold ring-1 ring-inset",
                type === item
                  ? "bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-ink-900 dark:ring-white"
                  : "bg-white/45 text-ink-600 ring-ink-900/[0.07] hover:bg-white/80 hover:text-ink-900 dark:bg-white/[0.04] dark:text-ink-300 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              {item === "ALL" ? "All formats" : item}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-semibold text-ink-500 dark:text-ink-400" aria-live="polite">
            {visible.length} shown
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <GlassCard className="px-6 py-14 text-center">
          <p className="font-display text-base font-bold text-ink-900 dark:text-white">No papers match that filter</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
            Try a shorter keyword or reset the exam and format filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setExamSlug("ALL");
              setType("ALL");
            }}
            className="press mt-4 rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-ink-900"
          >
            Reset filters
          </button>
        </GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((paper) => {
            const { tone, icon: Icon } = typeStyles[paper.type];
            return (
              <article key={paper.slug} className="glass lift group flex flex-col rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={tone}>
                      <Icon className="h-3 w-3" aria-hidden />
                      {paper.type}
                    </Badge>
                    <Badge>{paper.year}</Badge>
                  </div>
                  <span className="font-mono text-[10px] font-semibold text-ink-400 dark:text-ink-500">
                    {paper.shift}
                  </span>
                </div>

                <h2 className="mt-3 font-display text-[14px] font-bold tracking-[-0.01em] text-ink-900 dark:text-white">
                  <Link href={`/test/${paper.slug}`} className="hover:text-brand-700 dark:hover:text-brand-300">
                    {paper.title}
                  </Link>
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-ink-500 dark:text-ink-400">{paper.exam}</p>

                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                  <span>{paper.questions} questions</span>
                  <span>{paper.durationMins} min</span>
                  <span>{paper.marks} marks</span>
                  <span>{paper.negative > 0 ? `-${paper.negative.toFixed(2)}` : "No negative"}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {paper.sections.slice(0, 3).map((section) => (
                    <span
                      key={section.name}
                      className="rounded-full bg-ink-900/[0.04] px-2 py-1 text-[9.5px] font-semibold text-ink-600 dark:bg-white/[0.06] dark:text-ink-300"
                    >
                      {section.name} · {section.questions}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-900/[0.06] pt-3 dark:border-white/[0.08]">
                  <span className="text-[10px] font-medium text-ink-500 dark:text-ink-400">
                    {paper.attempts} attempts
                  </span>
                  <Link
                    href={`/test/${paper.slug}`}
                    className={cn(primaryButton, "px-3 py-1.5 text-[11.5px]")}
                  >
                    <Play className="h-3 w-3" aria-hidden />
                    Start
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 pt-2 text-[11px] font-medium text-ink-500 dark:text-ink-400">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Every exam has the same number of papers by design.
      </div>
    </div>
  );
}
