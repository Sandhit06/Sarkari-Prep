import { Compass, Github, Heart } from "lucide-react";

const columns = [
  {
    title: "Platform",
    links: [
      { label: "Exam directory", href: "#exams" },
      { label: "PYQs & mock tests", href: "#papers" },
      { label: "Shortcut lab", href: "/learn" },
      { label: "CBT simulator", href: "#dashboard" },
      { label: "Analytics", href: "#analytics" },
      { label: "Full product demo", href: "/standalone-preview.html" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Documentation", href: "#top" },
      { label: "Architecture", href: "#top" },
      { label: "Ingestion console", href: "/ingestion" },
      { label: "AGPL-3.0 license", href: "#top" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub", href: "https://github.com" },
      { label: "Review queue", href: "/ingestion" },
      { label: "Report a takedown", href: "#top" },
      { label: "Code of conduct", href: "#top" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mx-auto mt-20 w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <div className="glass rounded-3xl p-6 sm:p-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <a href="#top" className="press inline-flex items-center gap-2.5 rounded-xl" aria-label="SarkariPrep home">
              <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 via-brand-600 to-brand-900 ring-1 ring-white/25">
                <Compass className="relative h-5 w-5 text-white" strokeWidth={2.1} aria-hidden />
              </span>
              <span className="font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">
                Sarkari<span className="text-brand-600 dark:text-saffron-300">Prep</span>
              </span>
            </a>
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
              A public-information + open-source software project for Indian government exam aspirants. No ads, no
              tracking, no paywall.
            </p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="press mt-4 inline-flex items-center gap-2 rounded-xl border border-ink-900/10 bg-white/50 px-3 py-2 text-[11.5px] font-semibold text-ink-700 hover:text-ink-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-ink-200 dark:hover:text-white"
            >
              <Github className="h-3.5 w-3.5" aria-hidden />
              Star on GitHub
            </a>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                {column.title}
              </p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[12px] font-medium text-ink-600 transition-colors hover:text-ink-900 dark:text-ink-300 dark:hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-ink-900/[0.07] pt-5 text-[11px] text-ink-500 dark:border-white/[0.08] dark:text-ink-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} SarkariPrep contributors · AGPL-3.0-or-later</p>
          <p className="inline-flex items-center gap-1.5">
            Built in the open with
            <Heart className="h-3 w-3 text-rose-500" aria-hidden />
            for every aspirant
          </p>
        </div>
      </div>
    </footer>
  );
}
