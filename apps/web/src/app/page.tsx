import { ArrowRight, ArrowUpRight, Github, Play, Sparkles } from "lucide-react";
import { Aurora } from "@/components/aurora";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { StatsStrip } from "@/components/stats-strip";
import { Momentum } from "@/components/momentum";
import { ExamExplorer } from "@/components/exam-explorer";
import { Papers } from "@/components/papers";
import { LearningPreview } from "@/components/learning-preview";
import { Analytics } from "@/components/analytics";
import { SiteFooter } from "@/components/site-footer";
import { Badge, GlassCard, SectionHeading, primaryButton, secondaryButton } from "@/components/ui";
import { exams } from "@/lib/data";
import { cn } from "@/lib/cn";

export default function Page() {
  return (
    <>
      <Aurora />
      <SiteHeader />

      <main id="main" className="relative mx-auto w-full max-w-7xl px-4 pb-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <span id="top" className="block scroll-mt-32" />
        <Hero />
        <StatsStrip />

        <div className="mt-20 space-y-20 sm:mt-24 sm:space-y-24">
          <section id="dashboard" className="scroll-mt-32" aria-labelledby="dashboard-title">
            <SectionHeading
              id="dashboard-title"
              eyebrow="Your workspace"
              title="Momentum you can actually see"
              description="Readiness, resumable attempts and the four topics costing you the most marks — all computed from your own attempt history."
              action={
                <a href="#analytics" className={cn(secondaryButton, "px-3.5 py-2 text-[12.5px]")}>
                  Full analytics
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              }
            />
            <Momentum />
          </section>

          <section id="exams" className="scroll-mt-32" aria-labelledby="exams-title">
            <SectionHeading
              id="exams-title"
              eyebrow="Directory"
              title="20 exams. One clean catalogue."
              description="Eligibility, age limits, marking rules and timer patterns — structured data, not buried PDFs. Filter it, search it, start practising."
              action={
                <Badge tone="brand">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Seed data · editable
                </Badge>
              }
            />
            <ExamExplorer exams={exams} />
          </section>

          <section id="papers" className="scroll-mt-32" aria-labelledby="papers-title">
            <SectionHeading
              id="papers-title"
              eyebrow="Papers & mocks"
              title="Real papers, real marking, real timers"
              description="Official PYQs and full-length mocks with authentic negative marking. Or convert a paper of your own in five reviewable stages."
              action={
                <a href="#papers" className={cn(primaryButton, "px-3.5 py-2 text-[12.5px]")}>
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  Start a mock
                </a>
              }
            />
            <Papers />
          </section>

          <LearningPreview />

          <section id="analytics" className="scroll-mt-32" aria-labelledby="analytics-title">
            <SectionHeading
              id="analytics-title"
              eyebrow="Analytics"
              title="Know exactly what to fix next"
              description="Subject accuracy, score trajectory and study consistency — no vanity dashboards, just the next best action."
              action={
                <Badge tone="success">
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                  Synced locally
                </Badge>
              }
            />
            <Analytics />
          </section>

          {/* Closing CTA */}
          <section aria-labelledby="cta-title" className="scroll-mt-32">
            <GlassCard className="relative overflow-hidden p-7 sm:p-10">
              <div
                aria-hidden
                className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
              />
              <div
                aria-hidden
                className="absolute -bottom-28 -right-16 h-64 w-64 rounded-full bg-saffron-400/20 blur-3xl"
              />
              <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
                <div className="max-w-xl">
                  <Badge tone="saffron">Free forever · AGPL-3.0</Badge>
                  <h2
                    id="cta-title"
                    className="mt-3 font-display text-2xl font-extrabold tracking-[-0.025em] text-ink-900 text-balance dark:text-white sm:text-[2rem]"
                  >
                    Your next attempt starts with one paper.
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                    No account needed. Your progress stays in your browser, and the whole platform is yours to fork,
                    self-host and improve.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <a href="#papers" className={cn(primaryButton, "px-5 py-3 text-[13.5px]")}>
                    <Play className="h-4 w-4" aria-hidden />
                    Start a free mock
                  </a>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className={cn(secondaryButton, "px-5 py-3 text-[13.5px]")}
                  >
                    <Github className="h-4 w-4" aria-hidden />
                    View source
                  </a>
                </div>
              </div>
            </GlassCard>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
