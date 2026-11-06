import { ArrowUpRight, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Eyebrow, GlassCard, ProgressBar } from "@/components/ui";
import { scoreTrend, subjectAccuracy } from "@/lib/data";
import { cn } from "@/lib/cn";

const CHART_TOP = 20;
const CHART_BOTTOM = 180;
const X_START = 10;
const X_END = 630;

const points = scoreTrend.map((value, index) => ({
  x: X_START + (index / (scoreTrend.length - 1)) * (X_END - X_START),
  y: CHART_BOTTOM - (value / 100) * (CHART_BOTTOM - CHART_TOP),
}));

function smoothPath(pts: Array<{ x: number; y: number }>) {
  return pts.reduce((path, point, index, all) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = all[index - 1];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

const linePath = smoothPath(points);
const areaPath = `${linePath} L ${X_END} ${CHART_BOTTOM} L ${X_START} ${CHART_BOTTOM} Z`;
const last = points[points.length - 1];
const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];

const heatLevels = [
  "bg-ink-900/[0.06] dark:bg-white/[0.06]",
  "bg-brand-500/20",
  "bg-brand-500/35",
  "bg-brand-500/55",
  "bg-brand-500/75",
  "bg-brand-600",
];

const heatCells = Array.from({ length: 12 * 7 }, (_, index) => {
  const column = Math.floor(index / 7);
  const row = index % 7;
  const weekend = row > 4;
  const level = (column * 3 + row * 5 + ((column * row) % 4) + (weekend ? 2 : 0)) % 6;
  return level;
});

export function Analytics() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Score trend */}
      <GlassCard className="min-w-0 p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Eyebrow>Score trend</Eyebrow>
            <p className="mt-1 text-[11.5px] text-ink-500 dark:text-ink-400">Overall percentage · last 8 attempts</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="success">
              <TrendingUp className="h-3 w-3" aria-hidden />
              +40 pts
            </Badge>
            <Badge>Best 78%</Badge>
          </div>
        </div>

        <div className="mt-4">
          <div
            className="relative h-[180px] sm:h-[210px]"
            role="img"
            aria-label="Score trend rising from 38 to 78 percent over the last eight attempts"
          >
            <svg
              viewBox="0 0 640 200"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              <defs>
                <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3566f5" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#3566f5" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="trend-stroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#5b8cff" />
                  <stop offset="100%" stopColor="#f79009" />
                </linearGradient>
              </defs>

              {[20, 60, 100, 140, 180].map((y) => (
                <line
                  key={y}
                  x1={X_START}
                  x2={X_END}
                  y1={y}
                  y2={y}
                  className="stroke-ink-900/[0.07] dark:stroke-white/10"
                  strokeWidth="1"
                  strokeDasharray="3 5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              <path d={areaPath} fill="url(#trend-fill)" />
              <path
                d={linePath}
                fill="none"
                stroke="url(#trend-stroke)"
                strokeWidth="2.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {points.map((point, index) => (
              <span
                key={index}
                aria-hidden
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 dark:bg-[#0b101d]",
                  index === points.length - 1
                    ? "h-2.5 w-2.5 ring-saffron-500"
                    : "h-2 w-2 ring-brand-500",
                )}
                style={{ left: `${(point.x / 640) * 100}%`, top: `${(point.y / 200) * 100}%` }}
              />
            ))}

            <div
              aria-hidden
              className="absolute z-10 hidden sm:block"
              style={{
                left: `${(last.x / 640) * 100}%`,
                top: `${(last.y / 200) * 100}%`,
                transform: "translate(calc(-100% - 12px), -160%)",
              }}
            >
              <span className="inline-block whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 font-mono text-[10px] font-semibold text-white shadow-lg dark:bg-white dark:text-ink-900">
                78% · now
              </span>
            </div>
          </div>

          <div className="mt-2 flex justify-between font-mono text-[9.5px] font-medium text-ink-500 dark:text-ink-400">
            {months.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Accuracy by subject */}
      <GlassCard className="flex min-w-0 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow>Accuracy by subject</Eyebrow>
            <p className="mt-1 text-[11.5px] text-ink-500 dark:text-ink-400">Across last 5 attempts</p>
          </div>
          <a
            href="#dashboard"
            className="press grid h-8 w-8 place-items-center rounded-lg border border-ink-900/10 bg-white/50 text-ink-600 hover:text-ink-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-ink-300 dark:hover:text-white"
            aria-label="Open detailed analytics"
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>

        <ul className="mt-4 space-y-3.5">
          {subjectAccuracy.map((item) => (
            <li key={item.subject}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold text-ink-800 dark:text-ink-100">{item.subject}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-semibold text-ink-500 dark:text-ink-400">
                    {item.value}%
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold",
                      item.delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
                    )}
                  >
                    {item.delta >= 0 ? (
                      <TrendingUp className="h-2.5 w-2.5" aria-hidden />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" aria-hidden />
                    )}
                    {Math.abs(item.delta)}
                  </span>
                </span>
              </div>
              <ProgressBar
                value={item.value}
                tone={item.value >= 75 ? "emerald" : item.value >= 55 ? "brand" : "saffron"}
                className="mt-1.5"
              />
            </li>
          ))}
        </ul>

        <p className="mt-auto pt-4 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
          <span className="font-semibold text-ink-800 dark:text-ink-100">General awareness</span> is the single biggest
          lever left — 47% against an 80% target.
        </p>
      </GlassCard>

      {/* Consistency */}
      <GlassCard className="min-w-0 p-5 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Consistency</Eyebrow>
            <p className="mt-1 text-[11.5px] text-ink-500 dark:text-ink-400">Study days across the last 12 weeks</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="saffron">
              <Flame className="h-3 w-3" aria-hidden />
              12-day streak
            </Badge>
            <Badge tone="success">84 sessions</Badge>
          </div>
        </div>

        <div className="mt-4 min-w-0 overflow-x-auto pb-1">
          <div className="grid min-w-[520px] grid-flow-col grid-rows-7 gap-1">
            {heatCells.map((level, index) => (
              <span
                key={index}
                title={`Level ${level}`}
                className={cn("h-4 w-full rounded-[4px]", heatLevels[level])}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[10.5px] text-ink-500 dark:text-ink-400">
          <span>Less</span>
          <div className="flex items-center gap-1" aria-hidden>
            {heatLevels.map((tone, index) => (
              <span key={index} className={cn("h-3 w-3 rounded-[3px]", tone)} />
            ))}
          </div>
          <span>More</span>
        </div>
      </GlassCard>
    </div>
  );
}
