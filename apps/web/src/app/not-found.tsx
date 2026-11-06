import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { GlassCard, primaryButton } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function NotFound() {
  return (
    <>
      <Aurora />
      <main className="grid min-h-dvh place-items-center px-4 py-16">
        <GlassCard className="w-full max-w-md p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 via-brand-600 to-brand-900 ring-1 ring-white/25">
            <Compass className="h-6 w-6 text-white" aria-hidden />
          </span>
          <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400">
            404 · Off the syllabus
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.025em] text-ink-900 dark:text-white">
            This page isn&apos;t in the catalogue.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
            The link may have moved, or the paper was unpublished. Head back to the dashboard and pick up where you left
            off.
          </p>
          <Link href="/" className={cn(primaryButton, "mt-6 w-full px-4 py-3 text-[13.5px]")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to SarkariPrep
          </Link>
        </GlassCard>
      </main>
    </>
  );
}
