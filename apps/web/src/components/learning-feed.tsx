"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  Layers,
  Lightbulb,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { learningSubjects, learningTricks, type LearningTrick } from "@/lib/learning-tricks";
import { cn } from "@/lib/cn";

const SAVED_KEY = "sarkariprep:learning-saved";

const accentShell = {
  brand: "from-brand-500/18 via-brand-400/5 to-transparent",
  saffron: "from-saffron-400/22 via-saffron-300/5 to-transparent",
  emerald: "from-emerald-500/18 via-emerald-400/5 to-transparent",
  violet: "from-violet-500/18 via-violet-400/5 to-transparent",
} as const;

const accentText = {
  brand: "text-brand-700 dark:text-brand-300",
  saffron: "text-saffron-800 dark:text-saffron-200",
  emerald: "text-emerald-700 dark:text-emerald-300",
  violet: "text-violet-700 dark:text-violet-300",
} as const;

function toneFor(accent: LearningTrick["accent"]) {
  return accent === "emerald" ? "success" : accent;
}

export function LearningFeed() {
  const [subject, setSubject] = useState("ALL");
  const [saved, setSaved] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) setSaved(parsed.filter((item): item is string => typeof item === "string"));
    } catch {
      /* storage can be unavailable in private mode */
    }
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const filtered = useMemo(
    () => (subject === "ALL" ? learningTricks : learningTricks.filter((trick) => trick.subject === subject)),
    [subject],
  );

  const toggleSaved = (slug: string) => {
    setSaved((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      try {
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* storage can be unavailable in private mode */
      }
      return next;
    });
  };

  const copyTrick = async (trick: LearningTrick) => {
    const text = `${trick.title}\n${trick.shortcut}\n\n${trick.explanation}${
      trick.example ? `\n\nExample: ${trick.example}` : ""
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(trick.slug);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div>
      <div className="sticky top-[76px] z-30 -mx-2 mb-5 rounded-2xl border border-ink-900/[0.06] bg-white/70 p-2 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/70">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {learningSubjects.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSubject(item)}
              className={cn(
                "press shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition-colors",
                subject === item
                  ? "bg-ink-900 text-white shadow-sm dark:bg-white dark:text-ink-900"
                  : "text-ink-600 hover:bg-ink-900/[0.05] dark:text-ink-300 dark:hover:bg-white/10",
              )}
            >
              {item === "ALL" ? "All shortcuts" : item}
            </button>
          ))}
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 px-2 text-[10.5px] font-semibold text-ink-500 dark:text-ink-400 sm:flex">
            <Bookmark className="h-3 w-3" aria-hidden />
            {saved.length} saved
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5">
        {filtered.map((trick, index) => {
          const isSaved = saved.includes(trick.slug);
          const isCopied = copied === trick.slug;
          return (
            <article
              key={trick.slug}
              id={trick.slug}
              className="glass relative scroll-mt-32 overflow-hidden rounded-[2rem] p-5 sm:p-7"
            >
              <div
                aria-hidden
                className={cn(
                  "absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br blur-3xl",
                  accentShell[trick.accent],
                )}
              />
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={toneFor(trick.accent)}>{trick.subject}</Badge>
                    <Badge>{trick.topic}</Badge>
                    <Badge tone={trick.difficulty === "EASY" ? "success" : "neutral"}>
                      {trick.difficulty === "EASY" ? (
                        <Zap className="h-3 w-3" aria-hidden />
                      ) : (
                        <Lightbulb className="h-3 w-3" aria-hidden />
                      )}
                      {trick.difficulty.toLowerCase()}
                    </Badge>
                  </div>
                  <span className="font-mono text-[10.5px] font-semibold text-ink-400 dark:text-ink-500">
                    {String(index + 1).padStart(2, "0")} / {String(filtered.length).padStart(2, "0")}
                  </span>
                </div>

                <h2 className="mt-4 font-display text-xl font-extrabold leading-tight tracking-[-0.025em] text-ink-900 dark:text-white sm:text-2xl">
                  {trick.title}
                </h2>

                <div
                  className={cn(
                    "mt-4 rounded-2xl border border-ink-900/[0.06] bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.06]",
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                    The shortcut
                  </p>
                  <p
                    className={cn(
                      "mt-2 font-mono text-[13px] font-semibold leading-relaxed sm:text-sm",
                      accentText[trick.accent],
                    )}
                  >
                    {trick.shortcut}
                  </p>
                </div>

                <p className="mt-4 text-[13px] leading-relaxed text-ink-700 dark:text-ink-200">
                  {trick.explanation}
                </p>

                {trick.example ? (
                  <div className="mt-3 rounded-2xl border border-ink-900/[0.06] bg-ink-900/[0.025] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                      Worked example
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700 dark:text-ink-200">
                      {trick.example}
                    </p>
                    {trick.exampleHindi ? (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
                        {trick.exampleHindi}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {trick.mnemonic ? (
                  <p className="mt-3 inline-flex items-start gap-2 text-[12px] font-medium leading-relaxed text-ink-600 dark:text-ink-300">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-saffron-500" aria-hidden />
                    {trick.mnemonic}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/[0.06] pt-4 dark:border-white/[0.08]">
                  <div className="flex flex-wrap gap-1.5">
                    {trick.examTags.slice(0, 3).map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyTrick(trick)}
                      className="press glass-soft inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-semibold text-ink-700 dark:text-ink-200"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {isCopied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSaved(trick.slug)}
                      aria-pressed={isSaved}
                      className={cn(
                        "press inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11.5px] font-semibold ring-1 ring-inset",
                        isSaved
                          ? "bg-saffron-400/15 text-saffron-800 ring-saffron-500/25 dark:text-saffron-200"
                          : "bg-white/55 text-ink-700 ring-ink-900/10 dark:bg-white/[0.06] dark:text-ink-200 dark:ring-white/10",
                      )}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {isSaved ? "Saved" : "Save"}
                    </button>
                    <Link
                      href="/#papers"
                      className="press inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-3 py-2 text-[11.5px] font-semibold text-white dark:bg-white dark:text-ink-900"
                    >
                      Practice
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {filtered.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center">
            <Layers className="mx-auto h-7 w-7 text-ink-400" aria-hidden />
            <p className="mt-3 font-display text-lg font-bold text-ink-900 dark:text-white">
              No shortcuts in this subject yet
            </p>
            <p className="mt-1 text-[12.5px] text-ink-500 dark:text-ink-400">
              Try another filter while more tricks are being added.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
