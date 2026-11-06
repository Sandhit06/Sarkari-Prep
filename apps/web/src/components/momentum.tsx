import { ArrowUpRight, Flame, Gauge, Target, TrendingUp } from "lucide-react";
import { Badge, Eyebrow, GlassCard, ProgressBar } from "@/components/ui";
import { ContinueCard } from "@/components/continue-card";
import { focusTopics } from "@/lib/data";

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const READINESS = 78;

const metrics = [
  { icon: Target, label: "Accuracy", value: "74%" },
  { icon: Gauge, label: "Pace", value: "1.1 min/q" },
  { icon: Flame, label: "Streak", value: "12 days" },
];

export function Momentum() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Readiness */}
      <GlassCard className="lift flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow>Readiness index</Eyebrow>
            <p className="mt-1 text-[11.5px] text-ink-500 dark:text-ink-400">Rolling 30 days · all attempts</p>
          </div>
          <Badge tone="success">
            <TrendingUp className="h-3 w-3" aria-hidden />
            +8.4
          </Badge>
        </div>

        <div className="mt-5 flex flex-1 flex-col items-center justify-center">
          <div className="relative grid h-[150px] w-[150px] place-items-center">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
              <defs>
                <linearGradient id="readiness-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3566f5" />
                  <stop offset="60%" stopColor="#5b8cff" />
                  <stop offset="100%" stopColor="#f79009" />
                </linearGradient>
              </defs>
              <circle
                cx="70"
                cy="70"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="10"
                className="stroke-ink-900/[0.07] dark:stroke-white/10"
              />
              <circle
                cx="70"
                cy="70"
                r={RING_RADIUS}
                fill="none"
                stroke="url(#readiness-ring)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(READINESS / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <span className="font-display text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink-900 dark:text-white">
                {READINESS}
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                / 100
              </span>
            </div>
          </div>

          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            {metrics.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-ink-900/[0.05] bg-white/45 px-2 py-2 text-center dark:border-white/[0.08] dark:bg-white/[0.03]"
              >
                <Icon className="mx-auto h-3.5 w-3.5 text-ink-400 dark:text-ink-400" aria-hidden />
                <p className="mt-1.5 font-mono text-[11.5px] font-semibold leading-none text-ink-900 dark:text-white">
                  {value}
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-auto pt-4 text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
          You are on track for a <span className="font-semibold text-ink-800 dark:text-ink-100">Tier-I cut-off</span> in
          SSC CGL. Close the General Awareness gap to gain ~7 points.
        </p>
      </GlassCard>

      {/* Continue */}
      <ContinueCard />

      {/* Focus areas */}
      <GlassCard className="lift flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow>Focus areas</Eyebrow>
            <p className="mt-1 text-[11.5px] text-ink-500 dark:text-ink-400">Lowest accuracy · last 5 attempts</p>
          </div>
          <Badge tone="violet">4 topics</Badge>
        </div>

        <ul className="mt-4 space-y-3.5">
          {focusTopics.map((topic) => (
            <li key={topic.topic}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[12.5px] font-semibold text-ink-800 dark:text-ink-100">{topic.topic}</p>
                <span className="font-mono text-[11px] font-semibold text-ink-500 dark:text-ink-400">{topic.value}%</span>
              </div>
              <p className="mt-0.5 text-[10.5px] text-ink-500 dark:text-ink-400">{topic.subject}</p>
              <ProgressBar
                value={topic.value}
                tone={topic.value < 50 ? "saffron" : "brand"}
                className="mt-1.5"
              />
            </li>
          ))}
        </ul>

        <a
          href="#papers"
          className="press mt-auto inline-flex items-center justify-between gap-2 pt-4 text-[12px] font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
        >
          Build a targeted drill
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </GlassCard>
    </div>
  );
}
