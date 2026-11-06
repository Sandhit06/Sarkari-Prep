"use client";

import { useCallback, useEffect, useState } from "react";
import { Compass, Github, Menu, Moon, Play, Search, Sun, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { primaryButton } from "@/components/ui";

const NAV = [
  { id: "dashboard", label: "Dashboard", href: "/#dashboard" },
  { id: "exams", label: "Exams", href: "/#exams" },
  { id: "papers", label: "Papers", href: "/papers" },
  { id: "learn", label: "Learn", href: "/learn" },
  { id: "analytics", label: "Analytics", href: "/#analytics" },
];

function toggleTheme() {
  const root = document.documentElement;
  const next = root.classList.contains("dark") ? "light" : "dark";
  root.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem("sp-theme", next);
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("dashboard");

  const focusSearch = useCallback(() => {
    const input = document.getElementById("exam-search");
    if (!input) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    input.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    window.setTimeout(() => input.focus({ preventScroll: true }), reduce ? 0 : 420);
    setOpen(false);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.15, 0.4, 1] },
    );

    NAV.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusSearch]);

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto max-w-7xl">
        <div className="glass-strong flex items-center gap-2 rounded-[1.4rem] px-2 py-2 sm:px-3">
          {/* Brand */}
          <a
            href="/#top"
            className="press group flex shrink-0 items-center gap-2.5 rounded-xl px-1 py-1"
            aria-label="SarkariPrep home"
          >
            <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-400 via-brand-600 to-brand-900 ring-1 ring-white/25 shadow-[0_10px_24px_-12px_rgba(31,78,224,0.95)]">
              <span className="absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent" />
              <Compass className="relative h-5 w-5 text-white" strokeWidth={2.1} aria-hidden />
            </span>
            <span className="leading-none">
              <span className="block font-display text-[15px] font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">
                Sarkari<span className="text-brand-600 dark:text-saffron-300">Prep</span>
              </span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                Exam OS · v1.0
              </span>
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden flex-1 justify-center lg:flex">
            <nav
              aria-label="Sections"
              className="flex items-center gap-0.5 rounded-full border border-ink-900/[0.06] bg-ink-900/[0.035] p-1 dark:border-white/10 dark:bg-white/[0.05]"
            >
              {NAV.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => setActive(item.id)}
                  aria-current={active === item.id ? "true" : undefined}
                  className={cn(
                    "press rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold",
                    active === item.id
                      ? "bg-white text-ink-900 shadow-[0_1px_2px_rgba(13,20,36,0.08)] ring-1 ring-ink-900/[0.04] dark:bg-white/15 dark:text-white dark:ring-white/10"
                      : "text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white",
                  )}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={focusSearch}
              className="press glass-soft hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-ink-600 hover:text-ink-900 md:flex dark:text-ink-300 dark:hover:text-white"
              aria-label="Search exams (Ctrl K)"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span>Search</span>
              <kbd className="ml-1 rounded-md border border-ink-900/10 bg-white/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-500 dark:border-white/10 dark:bg-white/10 dark:text-ink-300">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="press glass-soft grid h-9 w-9 place-items-center rounded-full text-ink-700 hover:text-ink-900 dark:text-ink-200 dark:hover:text-white"
              aria-label="Toggle dark mode"
              title="Toggle theme"
            >
              <Moon className="h-4 w-4 dark:hidden" aria-hidden />
              <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
            </button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="press glass-soft hidden h-9 w-9 place-items-center rounded-full text-ink-700 hover:text-ink-900 sm:grid dark:text-ink-200 dark:hover:text-white"
              aria-label="View source on GitHub"
            >
              <Github className="h-4 w-4" aria-hidden />
            </a>

            <a href="/#papers" className={cn(primaryButton, "hidden h-9 px-3.5 py-0 text-[13px] sm:inline-flex")}>
              <Play className="h-3.5 w-3.5" aria-hidden />
              Start mock
            </a>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="press glass-soft grid h-9 w-9 place-items-center rounded-full text-ink-700 lg:hidden dark:text-ink-200"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>

        {/* Mobile sheet */}
        {open ? (
          <div id="mobile-menu" className="glass-strong animate-rise mt-2 rounded-2xl p-2 lg:hidden">
            <nav aria-label="Sections" className="grid gap-0.5">
              {NAV.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    setActive(item.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "press flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold",
                    active === item.id
                      ? "bg-white/70 text-ink-900 dark:bg-white/10 dark:text-white"
                      : "text-ink-600 hover:bg-white/50 dark:text-ink-300 dark:hover:bg-white/[0.06]",
                  )}
                >
                  {item.label}
                  <span className="font-mono text-[10px] text-ink-400 dark:text-ink-500">
                    0{NAV.indexOf(item) + 1}
                  </span>
                </a>
              ))}
            </nav>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-ink-900/5 pt-2 dark:border-white/10">
              <a href="/#papers" onClick={() => setOpen(false)} className={cn(primaryButton, "px-3 py-2 text-[13px]")}>
                <Play className="h-3.5 w-3.5" aria-hidden />
                Start mock
              </a>
              <button
                type="button"
                onClick={focusSearch}
                className="press glass-soft inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-800 dark:text-ink-100"
              >
                <Search className="h-3.5 w-3.5" aria-hidden />
                Search exams
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
