import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bot, ShieldAlert } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IngestionConsole } from "@/components/ingestion-console";
import { Badge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Ingestion console — SarkariPrep",
  description: "Internal console for official source syncing, AI extraction, and knowledge review.",
  robots: { index: false, follow: false },
};

export default function IngestionPage() {
  return (
    <>
      <Aurora />
      <SiteHeader />

      <main id="ingestion" className="relative mx-auto w-full max-w-7xl scroll-mt-32 px-4 pb-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="press glass-soft inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-700 dark:text-ink-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to dashboard
          </Link>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="brand">
              <Bot className="h-3 w-3" aria-hidden />
              Knowledge brain
            </Badge>
            <Badge tone="saffron">
              <ShieldAlert className="h-3 w-3" aria-hidden />
              Internal tool
            </Badge>
          </div>
        </div>

        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400">
            Ingestion console
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] text-ink-900 text-balance dark:text-white sm:text-[2.6rem] sm:leading-[1.08]">
            Fetch. Extract. Review. Publish.
          </h1>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-ink-600 text-pretty dark:text-ink-300">
            Run official feeds through the AI/heuristic extraction pipeline, inspect every run, and approve knowledge
            before it reaches the public papers and shortcut lab.
          </p>
        </div>

        <div className="mt-8">
          <IngestionConsole />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
