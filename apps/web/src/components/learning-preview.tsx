import Link from "next/link";
import { ArrowRight, Lightbulb, Sparkles, Zap } from "lucide-react";
import { Badge, GlassCard, SectionHeading } from "@/components/ui";
import { learningTricks } from "@/lib/learning-tricks";
import { cn } from "@/lib/cn";

const accentStyles = {
  brand: "from-brand-500/20 via-brand-400/5 to-transparent text-brand-700 dark:text-brand-300",
  saffron: "from-saffron-400/25 via-saffron-300/5 to-transparent text-saffron-800 dark:text-saffron-200",
  emerald: "from-emerald-500/20 via-emerald-400/5 to-transparent text-emerald-700 dark:text-emerald-300",
  violet: "from-violet-500/20 via-violet-400/5 to-transparent text-violet-700 dark:text-violet-300",
} as const;

export function LearningPreview() {
  const featured = learningTricks.slice(0, 3);

  return (
    <section id="learn" className="scroll-mt-32" aria-labelledby="learn-title">
      <SectionHeading
        id="learn-title"
        eyebrow="Shortcut lab"
        title="Learn the 20% that solves 80%"
        description="Bite-sized tricks for quant, reasoning, English and polity. Read one, then take a mock while it is still fresh."
        action={
          <Link
            href="/learn"
            className="press inline-flex items-center gap-2 rounded-xl border border-ink-900/10 bg-white/55 px-3.5 py-2 text-[12.5px] font-semibold text-ink-800 hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-ink-100 dark:hover:bg-white/10"
          >
            Open the feed
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {featured.map((trick, index) => (
          <GlassCard key={trick.slug} className="relative overflow-hidden p-5">
            <div
              aria-hidden
              className={cn(
                "absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br blur-2xl",
                accentStyles[trick.accent],
              )}
            />
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={trick.accent === "emerald" ? "success" : trick.accent}>
                  {trick.subject}
                </Badge>
                <span className="font-mono text-[10px] font-semibold text-ink-400 dark:text-ink-500">
                  0{index + 1}
                </span>
              </div>

              <h3 className="mt-4 font-display text-[17px] font-extrabold leading-snug tracking-[-0.02em] text-ink-900 dark:text-white">
                {trick.title}
              </h3>

              <p className="mt-3 rounded-2xl border border-ink-900/[0.06] bg-white/55 px-3.5 py-3 font-mono text-[12px] font-semibold leading-relaxed text-ink-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-ink-100">
                {trick.shortcut}
              </p>

              <p className="mt-3 line-clamp-3 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                {trick.explanation}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-ink-900/[0.06] pt-3 dark:border-white/[0.08]">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-500 dark:text-ink-400">
                  {trick.difficulty === "EASY" ? (
                    <Zap className="h-3 w-3" aria-hidden />
                  ) : (
                    <Lightbulb className="h-3 w-3" aria-hidden />
                  )}
                  {trick.topic}
                </span>
                <Link
                  href={`/learn#${trick.slug}`}
                  className="press inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300"
                >
                  Read
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium text-ink-500 dark:text-ink-400">
        <Sparkles className="h-3.5 w-3.5 text-saffron-500" aria-hidden />
        {learningTricks.length} shortcuts seeded and ready to extend
      </div>
    </section>
  );
}
