import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Layers, Sparkles } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PaperBrowser } from "@/components/paper-browser";
import { Badge } from "@/components/ui";
import { paperCatalog, papersPerExam } from "@/lib/paper-catalog";

export const metadata: Metadata = {
  title: "All practice papers — SarkariPrep",
  description:
    "Browse every dedicated government exam practice paper, with equal coverage across central, banking, railway, state PSC, teaching and defence exams.",
};

export default function PapersPage() {
  return (
    <>
      <Aurora />
      <SiteHeader />

      <main id="papers" className="relative mx-auto w-full max-w-7xl scroll-mt-32 px-4 pb-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="press glass-soft inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-semibold text-ink-700 dark:text-ink-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to dashboard
          </Link>
          <Badge tone="brand">
            <Sparkles className="h-3 w-3" aria-hidden />
            Complete paper library
          </Badge>
        </div>

        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400">
            Browse all papers
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] text-ink-900 text-balance dark:text-white sm:text-[2.6rem] sm:leading-[1.08]">
            {paperCatalog.length} dedicated test papers. {papersPerExam[0]?.count ?? 0} for every exam.
          </h1>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-ink-600 text-pretty dark:text-ink-300">
            Full mocks, sectional drills and speed tests, distributed evenly across every government exam in the
            directory. Open any card to start a timed attempt with marking and solutions.
          </p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            <Badge tone="success">
              <Layers className="h-3 w-3" aria-hidden />
              {paperCatalog.length} papers
            </Badge>
            <Badge tone="violet">{papersPerExam.length} exams</Badge>
            <Badge>Equal weightage</Badge>
          </div>
        </div>

        <div className="mt-8">
          <PaperBrowser papers={paperCatalog} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
