import { ArrowRight, Languages, Play, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { CbtPreview } from "@/components/cbt-preview";
import { Badge, primaryButton, secondaryButton } from "@/components/ui";
import { cn } from "@/lib/cn";

const trust = [
  { icon: ShieldCheck, label: "Community verified keys" },
  { icon: Languages, label: "Bilingual EN + हिन्दी" },
  { icon: Zap, label: "Instant scoring" },
];

export function Hero() {
  return (
    <section className="relative pt-6 sm:pt-10" aria-labelledby="hero-title">
      <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
        <div className="animate-rise">
          <Badge tone="brand" className="px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Open source · Free forever
            <span className="mx-0.5 h-3 w-px bg-brand-600/20 dark:bg-brand-200/20" />
            AGPL-3.0
          </Badge>

          <h1
            id="hero-title"
            className="mt-5 font-display text-[2.4rem] font-extrabold leading-[1.03] tracking-[-0.035em] text-ink-900 text-balance dark:text-white sm:text-[3.2rem] lg:text-[3.85rem]"
          >
            Crack India&apos;s toughest exams{" "}
            <span className="text-gradient">without the paywall.</span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-600 text-pretty dark:text-ink-300 sm:text-base">
            Official previous year papers, an exam-accurate CBT simulator and a paper converter that turns
            any PDF into a practice test. Built in the open, for every aspirant.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <a href="#papers" className={cn(primaryButton, "px-5 py-3 text-[14px]")}>
              <Play className="h-4 w-4" aria-hidden />
              Start a free mock
            </a>
            <a href="#exams" className={cn(secondaryButton, "px-5 py-3 text-[14px]")}>
              Browse 20 exams
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">No sign-up · No ads · Works offline once installed</p>

          <ul className="mt-7 flex flex-wrap gap-2">
            {trust.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="glass-soft inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-ink-600 dark:text-ink-300"
              >
                <Icon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-rise [animation-delay:120ms]">
          <CbtPreview />
        </div>
      </div>
    </section>
  );
}
