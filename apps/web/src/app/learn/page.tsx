import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Sparkles, Zap } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LearningFeed } from "@/components/learning-feed";
import { Badge } from "@/components/ui";
import { learningTricks } from "@/lib/learning-tricks";

export const metadata: Metadata = {
  title: "Shortcut Lab — SarkariPrep",
  description:
    "Bite-sized quant, reasoning, English and polity shortcuts for Indian government exams. Learn one trick, then practise it in a mock.",
};

export default function LearnPage() {
  const subjects = new Set(learningTricks.map((trick) => trick.subject)).size;

  return (
    <>
      <Aurora />
      <SiteHeader />

      <main id="learn" className="relative mx-auto w-full max-w-7xl scroll-mt-32 px-4 pb-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
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
            Shortcut lab
          </Badge>
        </div>

        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400">
            Learning feed
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] text-ink-900 text-balance dark:text-white sm:text-[2.6rem] sm:leading-[1.08]">
            One trick. One mock. Repeat.
          </h1>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-ink-600 text-pretty dark:text-ink-300">
            Swipe through exam-ready shortcuts, worked examples and memory hooks. Save the ones you want, copy them
            into your notes, then test them while the method is fresh.
          </p>

          <div className="mt-5 flex flex-wrap gap-1.5">
            <Badge tone="success">
              <BookOpen className="h-3 w-3" aria-hidden />
              {learningTricks.length} shortcuts
            </Badge>
            <Badge tone="violet">
              <Zap className="h-3 w-3" aria-hidden />
              {subjects} subjects
            </Badge>
            <Badge>Free forever</Badge>
          </div>
        </div>

        <div className="mt-8">
          <LearningFeed />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
