import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const primaryButton =
  "press inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 font-semibold text-white ring-1 ring-inset ring-white/20 shadow-[0_12px_28px_-14px_rgba(31,78,224,0.95)] hover:from-brand-400 hover:to-brand-500";

export const secondaryButton =
  "press glass-soft inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-ink-800 hover:bg-white/85 dark:text-ink-100 dark:hover:bg-white/10";

export function GlassCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass rounded-3xl", className)} {...props}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400",
        className,
      )}
    >
      {children}
    </p>
  );
}

type BadgeTone = "neutral" | "brand" | "saffron" | "success" | "violet" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral:
    "bg-ink-900/[0.05] text-ink-700 ring-ink-900/10 dark:bg-white/10 dark:text-ink-200 dark:ring-white/10",
  brand:
    "bg-brand-500/12 text-brand-700 ring-brand-600/20 dark:bg-brand-400/15 dark:text-brand-200 dark:ring-brand-300/25",
  saffron:
    "bg-saffron-400/15 text-saffron-800 ring-saffron-500/25 dark:bg-saffron-400/12 dark:text-saffron-200 dark:ring-saffron-300/20",
  success:
    "bg-emerald-500/12 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/12 dark:text-emerald-300 dark:ring-emerald-300/20",
  violet:
    "bg-violet-500/12 text-violet-700 ring-violet-600/20 dark:bg-violet-400/12 dark:text-violet-300 dark:ring-violet-300/20",
  danger:
    "bg-rose-500/12 text-rose-700 ring-rose-600/20 dark:bg-rose-400/12 dark:text-rose-300 dark:ring-rose-300/20",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          id={id}
          className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white sm:text-[1.75rem]"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-600 text-pretty dark:text-ink-300">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "brand",
  className,
}: {
  value: number;
  tone?: "brand" | "saffron" | "emerald" | "violet";
  className?: string;
}) {
  const tones = {
    brand: "from-brand-500 to-brand-400",
    saffron: "from-saffron-500 to-saffron-400",
    emerald: "from-emerald-500 to-emerald-400",
    violet: "from-violet-500 to-violet-400",
  } as const;

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-900/[0.07] dark:bg-white/10", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out", tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
