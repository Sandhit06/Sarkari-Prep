"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowUpRight, Clock3, Search, SlidersHorizontal, Timer, Users, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { categories, type Exam, type ExamCategory } from "@/lib/data";
import { cn } from "@/lib/cn";

const accentStyles: Record<Exam["accent"], string> = {
  brand: "bg-brand-500/12 text-brand-700 ring-brand-600/15 dark:bg-brand-400/12 dark:text-brand-300 dark:ring-brand-300/15",
  saffron:
    "bg-saffron-400/15 text-saffron-700 ring-saffron-500/20 dark:bg-saffron-400/10 dark:text-saffron-300 dark:ring-saffron-300/15",
  emerald:
    "bg-emerald-500/12 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/12 dark:text-emerald-300 dark:ring-emerald-300/15",
  violet:
    "bg-violet-500/12 text-violet-700 ring-violet-600/15 dark:bg-violet-400/12 dark:text-violet-300 dark:ring-violet-300/15",
};

const categoryLabel = (category: ExamCategory) =>
  categories.find((item) => item.id === category)?.label ?? category;

function monogram(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function ExamExplorer({ exams }: { exams: Exam[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExamCategory | "ALL">("ALL");
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    return exams.filter((exam) => {
      const matchesCategory = category === "ALL" || exam.category === category;
      const matchesQuery =
        term.length === 0 ||
        [exam.shortName, exam.name, exam.body, exam.category].some((value) =>
          value.toLowerCase().includes(term),
        );
      return matchesCategory && matchesQuery;
    });
  }, [exams, category, deferredQuery]);

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="glass rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-ink-500"
              aria-hidden
            />
            <label htmlFor="exam-search" className="sr-only">
              Search exams
            </label>
            <input
              id="exam-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search SSC CGL, IBPS PO, WBPSC, UPSC…"
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

          <div className="flex items-center gap-2 text-[11.5px] font-semibold text-ink-500 dark:text-ink-400">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            <span aria-live="polite">
              {visible.length} of {exams.length} exams
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              aria-pressed={category === item.id}
              className={cn(
                "press rounded-full px-3 py-1.5 text-[11.5px] font-semibold ring-1 ring-inset",
                category === item.id
                  ? "bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-ink-900 dark:ring-white"
                  : "bg-white/45 text-ink-600 ring-ink-900/[0.07] hover:bg-white/80 hover:text-ink-900 dark:bg-white/[0.04] dark:text-ink-300 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="glass rounded-2xl px-6 py-14 text-center">
          <p className="font-display text-base font-bold text-ink-900 dark:text-white">No exams match that filter</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
            Try a shorter keyword, or reset the category to browse the full directory.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("ALL");
            }}
            className="press mt-4 rounded-xl bg-ink-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-ink-900"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((exam) => (
            <article key={exam.slug} className="glass lift group flex flex-col rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-xl font-display text-[13px] font-extrabold ring-1 ring-inset",
                    accentStyles[exam.accent],
                  )}
                  aria-hidden
                >
                  {monogram(exam.shortName)}
                </span>
                <Badge tone={exam.category === "STATE_PSC" ? "saffron" : "neutral"}>
                  {categoryLabel(exam.category)}
                </Badge>
              </div>

              <h3 className="mt-3 font-display text-[15px] font-bold tracking-[-0.01em] text-ink-900 dark:text-white">
                {exam.shortName}
              </h3>
              <p className="mt-0.5 text-[12px] font-medium text-ink-700 dark:text-ink-200">{exam.name}</p>
              <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">{exam.body}</p>
              {exam.syllabus ? (
                <p className="mt-2 line-clamp-3 text-[10.5px] leading-relaxed text-ink-500 dark:text-ink-400" title={exam.syllabus}>
                  {exam.syllabus}
                </p>
              ) : null}

              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-900/[0.06] pt-3 text-[11px] dark:border-white/[0.08]">
                <div>
                  <dt className="text-ink-500 dark:text-ink-400">Eligibility</dt>
                  <dd className="mt-0.5 font-semibold text-ink-800 dark:text-ink-100">{exam.eligibility}</dd>
                </div>
                <div>
                  <dt className="text-ink-500 dark:text-ink-400">Age limit</dt>
                  <dd className="mt-0.5 font-semibold text-ink-800 dark:text-ink-100">{exam.age}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3 w-3" aria-hidden />
                  {exam.durationMins} min
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {exam.timing}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden />
                  {exam.papers} papers
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-ink-900/[0.06] pt-3 dark:border-white/[0.08]">
                <span className="font-mono text-[10.5px] font-semibold text-ink-500 dark:text-ink-400">
                  {exam.negativeMark > 0 ? `−${exam.negativeMark.toFixed(2)} negative` : "No negative marking"}
                </span>
                <a
                  href="#papers"
                  className="press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-400/10"
                >
                  Practice
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
