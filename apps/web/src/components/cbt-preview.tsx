"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Languages, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";

const QUESTION =
  "Which Article of the Constitution guarantees equality before the law to every person in India?";

const OPTIONS = [
  { id: "A", label: "Article 14" },
  { id: "B", label: "Article 19" },
  { id: "C", label: "Article 21" },
  { id: "D", label: "Article 32" },
];

const PALETTE: Array<"answered" | "review" | "skipped" | "idle"> = [
  "answered",
  "answered",
  "review",
  "skipped",
  "answered",
  "idle",
  "idle",
  "review",
  "answered",
  "skipped",
  "idle",
  "answered",
];

const paletteStyles: Record<(typeof PALETTE)[number], string> = {
  answered: "bg-emerald-700 text-white border-emerald-700/60 shadow-[0_4px_10px_-6px_rgba(4,120,87,0.9)]",
  review: "bg-violet-600 text-white border-violet-600/60 shadow-[0_4px_10px_-6px_rgba(124,58,237,0.9)]",
  skipped: "bg-rose-600 text-white border-rose-600/60 shadow-[0_4px_10px_-6px_rgba(225,29,72,0.9)]",
  idle: "bg-white/60 text-ink-600 border-ink-900/10 dark:bg-white/[0.05] dark:text-ink-300 dark:border-white/10",
};

function format(seconds: number) {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function CbtPreview() {
  const [selected, setSelected] = useState<string | null>("A");
  const [secondsLeft, setSecondsLeft] = useState(3427);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-3 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-brand-500/25 via-transparent to-saffron-400/25 blur-2xl sm:-inset-5"
      />

      <div className="glass-strong grain relative overflow-hidden rounded-[1.9rem] p-3 sm:p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live CBT preview
            </p>
            <p className="mt-1 truncate font-display text-sm font-bold text-ink-900 dark:text-white">
              SSC CGL 2024 · Tier I
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-lg border border-ink-900/10 bg-white/60 px-2 py-1 font-mono text-[11px] font-semibold text-ink-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-ink-200">
              <Clock3 className="h-3 w-3" aria-hidden />
              {format(secondsLeft)}
            </span>
            <span className="hidden items-center gap-1 rounded-lg border border-ink-900/10 bg-white/60 px-2 py-1 text-[11px] font-semibold text-ink-600 sm:inline-flex dark:border-white/10 dark:bg-white/[0.06] dark:text-ink-300">
              <Languages className="h-3 w-3" aria-hidden />
              EN / हिं
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="rounded-2xl border border-ink-900/[0.06] bg-white/65 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
            <span>Q. 5 · Polity</span>
            <span className="text-brand-600 dark:text-brand-300">+2.0 / −0.50</span>
          </div>
          <p className="mt-2 text-[13.5px] font-medium leading-relaxed text-ink-800 text-pretty dark:text-ink-100">
            {QUESTION}
          </p>

          <div className="mt-3 grid gap-1.5">
            {OPTIONS.map((option) => {
              const isSelected = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelected(option.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "press group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-[12.5px] font-medium",
                    isSelected
                      ? "border-brand-500/60 bg-brand-500/10 text-ink-900 shadow-[0_0_0_3px_rgba(53,102,245,0.10)] dark:text-white"
                      : "border-ink-900/[0.07] bg-white/45 text-ink-700 hover:border-brand-500/40 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.02] dark:text-ink-200 dark:hover:bg-white/[0.07]",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors",
                      isSelected
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-ink-900/15 text-ink-500 group-hover:border-brand-400 dark:border-white/20 dark:text-ink-400",
                    )}
                  >
                    {isSelected ? <Check className="h-3.5 w-3.5" aria-hidden /> : option.id}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Palette */}
        <div className="mt-3 rounded-2xl border border-ink-900/[0.06] bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              Question palette
            </p>
            <p className="font-mono text-[10px] text-ink-500 dark:text-ink-400">5 / 100</p>
          </div>
          <div className="mt-2 grid grid-cols-12 gap-1">
            {PALETTE.map((status, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Question ${index + 1}: ${status}`}
                className={cn(
                  "press grid aspect-square place-items-center rounded-md border font-mono text-[10px] font-bold",
                  index === 4 ? "ring-2 ring-brand-500/70 ring-offset-1 ring-offset-transparent" : "",
                  paletteStyles[status],
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-medium text-ink-500 dark:text-ink-400">
            <span className="inline-flex items-center gap-1">
              <i className="h-2 w-2 rounded-sm bg-emerald-500" /> Answered
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-2 w-2 rounded-sm bg-rose-500" /> Skipped
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-2 w-2 rounded-full bg-violet-500" /> Review
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Proctored
            </span>
          </div>
        </div>
      </div>

      {/* Mini stats — kept below the card so they never cover the question panel */}
      <div className="mt-3 hidden gap-2 sm:flex">
        <div className="glass-soft flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl px-3 py-2">
          <span className="truncate text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
            Accuracy today
          </span>
          <span className="shrink-0 font-display text-sm font-extrabold text-ink-900 dark:text-white">
            74%<span className="ml-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">+6</span>
          </span>
        </div>
        <div className="glass-soft flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl px-3 py-2">
          <span className="truncate text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
            Sectional lock
          </span>
          <span className="shrink-0 font-mono text-[11px] font-bold text-ink-800 dark:text-ink-100">ON · 4 parts</span>
        </div>
      </div>
    </div>
  );
}
