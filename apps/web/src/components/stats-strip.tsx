import { BookOpen, Languages, Sparkles, UploadCloud } from "lucide-react";
import { stats } from "@/lib/data";

const icons = [BookOpen, Languages, UploadCloud, Sparkles];

const accents = [
  "text-brand-600 bg-brand-500/10 ring-brand-600/15 dark:text-brand-300 dark:bg-brand-400/10 dark:ring-brand-300/15",
  "text-saffron-600 bg-saffron-400/15 ring-saffron-500/20 dark:text-saffron-300 dark:bg-saffron-400/10 dark:ring-saffron-300/15",
  "text-emerald-600 bg-emerald-500/10 ring-emerald-600/15 dark:text-emerald-300 dark:bg-emerald-400/10 dark:ring-emerald-300/15",
  "text-violet-600 bg-violet-500/10 ring-violet-600/15 dark:text-violet-300 dark:bg-violet-400/10 dark:ring-violet-300/15",
];

export function StatsStrip() {
  return (
    <div className="mt-14 grid grid-cols-2 gap-3 sm:mt-16 sm:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = icons[index % icons.length];
        return (
          <div
            key={stat.label}
            className="glass lift group rounded-2xl p-4"
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ring-inset ${accents[index % accents.length]}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <p className="mt-3 font-display text-xl font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white sm:text-2xl">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[12px] font-semibold text-ink-700 dark:text-ink-200">{stat.label}</p>
            <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">{stat.note}</p>
          </div>
        );
      })}
    </div>
  );
}
