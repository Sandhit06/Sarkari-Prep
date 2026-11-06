"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  Globe2,
  Inbox,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge, GlassCard, SectionHeading, primaryButton, secondaryButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createIngestionSource,
  fetchIngestionHealth,
  fetchIngestionRun,
  fetchIngestionRuns,
  fetchIngestionSources,
  fetchKnowledge,
  ingestManualKnowledge,
  publishKnowledgeItem,
  rejectKnowledgeItem,
  runIngestionSource,
  syncDueIngestionSources,
  updateIngestionSource,
  type IngestionHealth,
  type IngestionRun,
  type IngestionRunStatus,
  type IngestionRunSummary,
  type IngestionSource,
  type IngestionSourceKind,
  type KnowledgeItem,
  type KnowledgeKind,
  type KnowledgeStatus,
} from "@/lib/ingestion";

type Tab = "overview" | "sources" | "runs" | "review" | "ingest";
type BadgeTone = "neutral" | "brand" | "saffron" | "success" | "violet" | "danger";

const TABS: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "sources", label: "Sources", icon: Globe2 },
  { id: "runs", label: "Runs", icon: Clock3 },
  { id: "review", label: "Review", icon: Inbox },
  { id: "ingest", label: "Manual ingest", icon: Send },
];

const SOURCE_KINDS: IngestionSourceKind[] = ["OFFICIAL_HTML", "RSS_JSON", "JSON_API", "SITEMAP", "MANUAL"];
const KNOWLEDGE_KINDS: KnowledgeKind[] = [
  "EXAM_UPDATE",
  "NOTIFICATION",
  "SYLLABUS",
  "QUESTION",
  "LEARNING_TRICK",
  "STRATEGY",
];
const KNOWLEDGE_STATUSES: KnowledgeStatus[] = ["DRAFT", "APPROVED", "PUBLISHED", "REJECTED"];

const runTone: Record<IngestionRunStatus, BadgeTone> = {
  QUEUED: "neutral",
  FETCHING: "brand",
  EXTRACTING: "brand",
  NEEDS_REVIEW: "saffron",
  COMPLETED: "success",
  FAILED: "danger",
  SKIPPED: "neutral",
};

const knowledgeTone: Record<KnowledgeStatus, BadgeTone> = {
  DRAFT: "saffron",
  APPROVED: "brand",
  PUBLISHED: "success",
  REJECTED: "danger",
};

const kindTone: Record<KnowledgeKind, BadgeTone> = {
  EXAM_UPDATE: "brand",
  NOTIFICATION: "saffron",
  SYLLABUS: "violet",
  QUESTION: "success",
  LEARNING_TRICK: "violet",
  STRATEGY: "neutral",
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function formatDate(value?: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet" : dateFormatter.format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function statusDot(configured: boolean) {
  return configured ? "bg-emerald-500" : "bg-ink-300 dark:bg-white/25";
}

const emptySourceForm = {
  name: "",
  url: "",
  kind: "OFFICIAL_HTML" as IngestionSourceKind,
  examSlug: "",
  cadenceMinutes: "1440",
  trustScore: "0.7",
  enabled: true,
};

const emptyManualForm = {
  text: "",
  title: "",
  kind: "EXAM_UPDATE" as KnowledgeKind,
  examSlug: "",
  subject: "",
  topic: "",
  tags: "",
  extractedJson: "",
};

const exampleText = `Successive percentage shortcut

When a value changes by a% and then by b%, the net change is a + b + (ab / 100) percent.
Use the sign carefully: a 20% increase followed by a 10% decrease is 20 - 10 - (20 x 10 / 100) = 8% net increase.
Example: A salary of Rs 50,000 rises 20% and then falls 10%. Final salary = 50,000 x 1.20 x 0.90 = Rs 54,000, an 8% rise.`;

export function IngestionConsole() {
  const [tab, setTab] = useState<Tab>("overview");
  const [health, setHealth] = useState<IngestionHealth | null>(null);
  const [sources, setSources] = useState<IngestionSource[]>([]);
  const [runs, setRuns] = useState<IngestionRunSummary[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<IngestionRun | null>(null);
  const [runLoading, setRunLoading] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<KnowledgeStatus | "">("DRAFT");
  const [kindFilter, setKindFilter] = useState<KnowledgeKind | "">("");
  const [search, setSearch] = useState("");

  const [sourceForm, setSourceForm] = useState(emptySourceForm);
  const [manualForm, setManualForm] = useState(emptyManualForm);

  const loadOverview = useCallback(async () => {
    const [nextHealth, nextSources, nextRuns] = await Promise.all([
      fetchIngestionHealth(),
      fetchIngestionSources(),
      fetchIngestionRuns(30),
    ]);
    setHealth(nextHealth);
    setSources(nextSources);
    setRuns(nextRuns.runs);
  }, []);

  const loadKnowledge = useCallback(async () => {
    const response = await fetchKnowledge({
      status: statusFilter || undefined,
      kind: kindFilter || undefined,
      q: search.trim() || undefined,
    });
    setKnowledge(response.items);
  }, [statusFilter, kindFilter, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchIngestionHealth(), fetchIngestionSources(), fetchIngestionRuns(30)])
      .then(([nextHealth, nextSources, nextRuns]) => {
        if (cancelled) return;
        setHealth(nextHealth);
        setSources(nextSources);
        setRuns(nextRuns.runs);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setKnowledgeLoading(true);
    const timer = window.setTimeout(() => {
      fetchKnowledge({
        status: statusFilter || undefined,
        kind: kindFilter || undefined,
        q: search.trim() || undefined,
      })
        .then((response) => {
          if (!cancelled) setKnowledge(response.items);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(errorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setKnowledgeLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [statusFilter, kindFilter, search]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const applyHash = () => {
      const next = window.location.hash.replace(/^#/, "") as Tab;
      if (TABS.some((item) => item.id === next)) setTab(next);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const selectTab = useCallback((next: Tab) => {
    setTab(next);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      /* history can be unavailable in embedded contexts */
    }
  }, []);

  const pendingCount = useMemo(
    () => knowledge.filter((item) => item.status === "DRAFT").length,
    [knowledge],
  );

  const activeSources = useMemo(() => sources.filter((source) => source.enabled), [sources]);

  const refreshAfterMutation = useCallback(async () => {
    await Promise.all([loadOverview(), loadKnowledge()]);
  }, [loadOverview, loadKnowledge]);

  async function handleToggleSource(source: IngestionSource) {
    setBusy(`toggle:${source.id}`);
    setError(null);
    try {
      await updateIngestionSource(source.id, { enabled: !source.enabled });
      setNotice(`${source.name} ${source.enabled ? "paused" : "resumed"}.`);
      await loadOverview();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleRunSource(source: IngestionSource, force: boolean) {
    setBusy(`run:${source.id}`);
    setError(null);
    try {
      const run = await runIngestionSource(source.id, force);
      setNotice(`${source.name}: ${run.status.toLowerCase()} with ${run.itemsFound} item(s).`);
      setSelectedRun(run);
      await refreshAfterMutation();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleSync() {
    setBusy("sync");
    setError(null);
    try {
      const result = await syncDueIngestionSources();
      setNotice(`Checked ${result.checked} due source(s), ran ${result.ran}.`);
      await refreshAfterMutation();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleOpenRun(runId: string) {
    setRunLoading(runId);
    setError(null);
    try {
      setSelectedRun(await fetchIngestionRun(runId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRunLoading(null);
    }
  }

  async function handlePublish(item: KnowledgeItem) {
    setBusy(`publish:${item.id}`);
    setError(null);
    try {
      const result = await publishKnowledgeItem(item.id);
      const materialized = result.materialized;
      setNotice(
        materialized
          ? `Published and created ${String(materialized.type)} "${String(materialized.slug)}".`
          : "Knowledge item published.",
      );
      await refreshAfterMutation();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(item: KnowledgeItem) {
    setBusy(`reject:${item.id}`);
    setError(null);
    try {
      await rejectKnowledgeItem(item.id);
      setNotice("Knowledge item rejected.");
      await refreshAfterMutation();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create-source");
    setError(null);
    try {
      const created = await createIngestionSource({
        name: sourceForm.name,
        url: sourceForm.url,
        kind: sourceForm.kind,
        examSlug: sourceForm.examSlug || undefined,
        cadenceMinutes: Number(sourceForm.cadenceMinutes) || 1440,
        trustScore: Number(sourceForm.trustScore) || 0.7,
        enabled: sourceForm.enabled,
      });
      setNotice(`Added ${created.name}.`);
      setSourceForm(emptySourceForm);
      await loadOverview();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleManualIngest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("manual");
    setError(null);

    let extractedJson: unknown;
    if (manualForm.extractedJson.trim()) {
      try {
        extractedJson = JSON.parse(manualForm.extractedJson);
      } catch {
        setError("Extracted JSON is not valid JSON.");
        setBusy(null);
        return;
      }
    }

    try {
      const run = await ingestManualKnowledge({
        text: manualForm.text,
        title: manualForm.title || undefined,
        kind: manualForm.kind,
        examSlug: manualForm.examSlug || undefined,
        subject: manualForm.subject || undefined,
        topic: manualForm.topic || undefined,
        tags: manualForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        extractedJson,
      });
      setNotice(`Manual run ${run.status.toLowerCase()} with ${run.itemsFound} item(s).`);
      setSelectedRun(run);
      setManualForm((current) => ({ ...current, text: "", title: "", extractedJson: "" }));
      await refreshAfterMutation();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function loadExample() {
    setManualForm((current) => ({
      ...current,
      text: exampleText,
      title: "Successive percentage shortcut",
      kind: "LEARNING_TRICK",
      examSlug: "ssc-cgl",
      subject: "Quantitative Aptitude",
      topic: "Percentages",
      tags: "percentage, shortcut, ssc-cgl",
      extractedJson: JSON.stringify(
        {
          example: "50,000 x 1.20 x 0.90 = 54,000",
          mnemonic: "a + b + ab/100",
          difficulty: "EASY",
          accent: "saffron",
        },
        null,
        2,
      ),
    }));
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={health?.schedulerEnabled ? "success" : "neutral"}>
            <Clock3 className="h-3 w-3" aria-hidden />
            Scheduler {health?.schedulerEnabled ? "on" : "off"}
          </Badge>
          <Badge tone="brand">
            <Bot className="h-3 w-3" aria-hidden />
            {health?.configuredProvider || "auto"}
          </Badge>
          <Badge tone="violet">
            <Database className="h-3 w-3" aria-hidden />
            {health?.database.sources ?? sources.length} sources
          </Badge>
          <Badge tone="saffron">
            <Inbox className="h-3 w-3" aria-hidden />
            {health?.database.pendingKnowledge ?? pendingCount} pending
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            void refreshAfterMutation().catch((err: unknown) => setError(errorMessage(err)));
          }}
          className={cn(secondaryButton, "h-9 px-3.5 text-[12px]")}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh
        </button>
      </div>

      <div className="sticky top-[76px] z-30 -mx-2 mb-5 rounded-2xl border border-ink-900/[0.06] bg-white/70 p-2 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/70">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={cn(
                  "press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition-colors",
                  tab === item.id
                    ? "bg-ink-900 text-white shadow-sm dark:bg-white dark:text-ink-900"
                    : "text-ink-600 hover:bg-ink-900/[0.05] dark:text-ink-300 dark:hover:bg-white/10",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[12.5px] font-medium text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[12.5px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {loading ? (
        <GlassCard className="flex items-center justify-center gap-2 p-10 text-sm font-semibold text-ink-600 dark:text-ink-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading ingestion console...
        </GlassCard>
      ) : null}

      {!loading && tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Sources" value={health?.database.sources ?? sources.length} hint={`${activeSources.length} active`} icon={Globe2} />
            <StatCard label="Pending review" value={health?.database.pendingKnowledge ?? 0} hint="Draft knowledge" icon={Inbox} tone="saffron" />
            <StatCard label="Runs" value={health?.database.runs ?? runs.length} hint="All-time ingestion runs" icon={Activity} tone="brand" />
            <StatCard label="Published" value={health?.database.publishedKnowledge ?? 0} hint="Materialized knowledge" icon={ShieldCheck} tone="success" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <GlassCard className="p-5 sm:p-6">
              <SectionHeading
                eyebrow="AI providers"
                title="Extraction stack"
                description="The API tries configured providers in order, then falls back to local rules. No provider key is required for heuristic extraction."
                action={
                  <button type="button" onClick={handleSync} disabled={busy === "sync"} className={cn(primaryButton, "h-9 px-3.5 text-[12px]")}>
                    {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Zap className="h-3.5 w-3.5" aria-hidden />}
                    Sync due
                  </button>
                }
              />
              <div className="grid gap-2.5">
                {health?.providers.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink-900/[0.06] bg-white/45 px-3.5 py-3 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={cn("h-2 w-2 rounded-full", statusDot(provider.configured))} />
                      <div>
                        <p className="text-[12.5px] font-bold text-ink-900 dark:text-white">{provider.name}</p>
                        <p className="text-[10.5px] font-medium text-ink-500 dark:text-ink-400">{provider.model}</p>
                      </div>
                    </div>
                    <Badge tone={provider.configured ? "success" : "neutral"}>
                      {provider.configured ? "configured" : "not configured"}
                    </Badge>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <SectionHeading
                eyebrow="Queue"
                title="Needs attention"
                description="Runs that produced draft knowledge wait here until an operator publishes or rejects them."
              />
              {runs.length ? (
                <div className="space-y-2">
                  {runs.slice(0, 5).map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => void handleOpenRun(run.id)}
                      className="press flex w-full items-start justify-between gap-3 rounded-2xl border border-ink-900/[0.06] bg-white/45 px-3.5 py-3 text-left hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-bold text-ink-900 dark:text-white">
                          {run.source?.name || "Manual paste"}
                        </p>
                        <p className="mt-0.5 truncate text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                          {run.summary || "No summary"} · {formatDate(run.startedAt)}
                        </p>
                      </div>
                      <Badge tone={runTone[run.status]}>{run.status}</Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Inbox} title="No runs yet" description="Run a source or paste text to create the first review item." />
              )}
            </GlassCard>
          </div>

          <GlassCard className="p-5 sm:p-6">
            <SectionHeading
              eyebrow="Source health"
              title="Official feeds"
              description="Pause noisy feeds, force a refresh, or open the full source list."
              action={
                <button type="button" onClick={() => selectTab("sources")} className={cn(secondaryButton, "h-9 px-3.5 text-[12px]")}>
                  Manage sources
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              }
            />
            <div className="grid gap-2.5 md:grid-cols-2">
              {sources.slice(0, 6).map((source) => (
                <div key={source.id} className="rounded-2xl border border-ink-900/[0.06] bg-white/45 p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-ink-900 dark:text-white">{source.name}</p>
                      <p className="mt-0.5 truncate text-[10.5px] font-medium text-ink-500 dark:text-ink-400">{source.slug}</p>
                    </div>
                    <Badge tone={source.enabled ? "success" : "neutral"}>{source.enabled ? "active" : "paused"}</Badge>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {source.lastStatus ? <Badge tone={runTone[source.lastStatus]}>{source.lastStatus}</Badge> : <Badge>never run</Badge>}
                    <Badge>{source.cadenceMinutes}m cadence</Badge>
                    <Badge tone="violet">{source._count?.knowledge ?? 0} items</Badge>
                  </div>
                  <p className="mt-2 text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                    Last run: {formatDate(source.lastRunAt)}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}

      {!loading && tab === "sources" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {sources.map((source) => (
              <GlassCard key={source.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={source.enabled ? "success" : "neutral"}>{source.enabled ? "active" : "paused"}</Badge>
                      <Badge tone="brand">{source.kind}</Badge>
                      {source.examSlug ? <Badge tone="violet">{source.examSlug}</Badge> : null}
                    </div>
                    <h3 className="mt-2 font-display text-lg font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">
                      {source.name}
                    </h3>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      <Globe2 className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="truncate">{source.url}</span>
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleRunSource(source, !source.enabled)}
                      disabled={busy === `run:${source.id}`}
                      className={cn(primaryButton, "h-8 px-3 text-[11.5px]")}
                    >
                      {busy === `run:${source.id}` ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
                      Run
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRunSource(source, true)}
                      disabled={busy === `run:${source.id}`}
                      className={cn(secondaryButton, "h-8 px-3 text-[11.5px]")}
                      title="Run even if the content hash is unchanged"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden />
                      Force
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleSource(source)}
                      disabled={busy === `toggle:${source.id}`}
                      className={cn(secondaryButton, "h-8 px-3 text-[11.5px]")}
                    >
                      {busy === `toggle:${source.id}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      ) : source.enabled ? (
                        <Pause className="h-3 w-3" aria-hidden />
                      ) : (
                        <Play className="h-3 w-3" aria-hidden />
                      )}
                      {source.enabled ? "Pause" : "Resume"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MiniStat label="Last status" value={source.lastStatus || "never"} />
                  <MiniStat label="Last run" value={formatDate(source.lastRunAt)} />
                  <MiniStat label="Next run" value={formatDate(source.nextRunAt)} />
                  <MiniStat label="Items" value={String(source._count?.knowledge ?? 0)} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                  <span className="rounded-full bg-ink-900/[0.04] px-2 py-1 dark:bg-white/[0.06]">cadence {source.cadenceMinutes}m</span>
                  <span className="rounded-full bg-ink-900/[0.04] px-2 py-1 dark:bg-white/[0.06]">trust {Math.round(source.trustScore * 100)}%</span>
                  <span className="rounded-full bg-ink-900/[0.04] px-2 py-1 dark:bg-white/[0.06]">{source._count?.runs ?? 0} runs</span>
                  <span className="rounded-full bg-ink-900/[0.04] px-2 py-1 dark:bg-white/[0.06]">slug {source.slug}</span>
                </div>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="h-fit p-5 sm:p-6">
            <SectionHeading eyebrow="New feed" title="Add a source" description="Official HTML pages, RSS/JSON feeds, sitemaps, or manual endpoints." />
            <form onSubmit={handleCreateSource} className="space-y-3">
              <Field label="Name">
                <input
                  required
                  value={sourceForm.name}
                  onChange={(event) => setSourceForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="SSC latest notices"
                  className={inputClass}
                />
              </Field>
              <Field label="URL">
                <input
                  required
                  type="url"
                  value={sourceForm.url}
                  onChange={(event) => setSourceForm((current) => ({ ...current, url: event.target.value }))}
                  placeholder="https://ssc.gov.in/"
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kind">
                  <select
                    value={sourceForm.kind}
                    onChange={(event) => setSourceForm((current) => ({ ...current, kind: event.target.value as IngestionSourceKind }))}
                    className={inputClass}
                  >
                    {SOURCE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Exam slug">
                  <input
                    value={sourceForm.examSlug}
                    onChange={(event) => setSourceForm((current) => ({ ...current, examSlug: event.target.value }))}
                    placeholder="ssc-cgl"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cadence (minutes)">
                  <input
                    type="number"
                    min={15}
                    max={43200}
                    value={sourceForm.cadenceMinutes}
                    onChange={(event) => setSourceForm((current) => ({ ...current, cadenceMinutes: event.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Trust score">
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={sourceForm.trustScore}
                    onChange={(event) => setSourceForm((current) => ({ ...current, trustScore: event.target.value }))}
                    className={inputClass}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-700 dark:text-ink-200">
                <input
                  type="checkbox"
                  checked={sourceForm.enabled}
                  onChange={(event) => setSourceForm((current) => ({ ...current, enabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                Enable immediately
              </label>
              <button type="submit" disabled={busy === "create-source"} className={cn(primaryButton, "h-10 w-full px-4 text-[12.5px]")}>
                {busy === "create-source" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Add source
              </button>
            </form>
          </GlassCard>
        </div>
      ) : null}

      {!loading && tab === "runs" ? (
        <GlassCard className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="History"
            title="Ingestion runs"
            description="Open any run to inspect the extracted knowledge, HTTP status, provider, and raw excerpt."
            action={
              <button type="button" onClick={handleSync} disabled={busy === "sync"} className={cn(secondaryButton, "h-9 px-3.5 text-[12px]")}>
                {busy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Zap className="h-3.5 w-3.5" aria-hidden />}
                Sync due
              </button>
            }
          />
          {runs.length ? (
            <div className="space-y-2">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => void handleOpenRun(run.id)}
                  className="press flex w-full flex-wrap items-start justify-between gap-3 rounded-2xl border border-ink-900/[0.06] bg-white/45 px-4 py-3 text-left hover:bg-white/70 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={runTone[run.status]}>{run.status}</Badge>
                      <Badge tone="brand">{run.providerUsed}</Badge>
                      {run.httpStatus ? <Badge>HTTP {run.httpStatus}</Badge> : null}
                      <Badge tone="violet">{run.itemsFound} items</Badge>
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] font-bold text-ink-900 dark:text-white">
                      {run.source?.name || "Manual paste"}
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                      {run.summary || run.errorMessage || "No summary"} · {formatDate(run.startedAt)}
                    </p>
                  </div>
                  {runLoading === run.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-ink-500" aria-hidden />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-ink-400" aria-hidden />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Clock3} title="No runs yet" description="Run a source or submit manual text to populate the run history." />
          )}
        </GlassCard>
      ) : null}

      {!loading && tab === "review" ? (
        <div>
          <GlassCard className="mb-4 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
              <Field label="Status">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as KnowledgeStatus | "")}
                  className={inputClass}
                >
                  <option value="">All statuses</option>
                  {KNOWLEDGE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Kind">
                <select
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value as KnowledgeKind | "")}
                  className={inputClass}
                >
                  <option value="">All kinds</option>
                  {KNOWLEDGE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Search">
                <div className="relative">
                  <FileSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" aria-hidden />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Title, summary or content"
                    className={cn(inputClass, "pl-9")}
                  />
                </div>
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("DRAFT");
                    setKindFilter("");
                    setSearch("");
                  }}
                  className={cn(secondaryButton, "h-10 px-3.5 text-[12px]")}
                >
                  Reset
                </button>
              </div>
            </div>
          </GlassCard>

          {knowledgeLoading ? (
            <GlassCard className="flex items-center justify-center gap-2 p-10 text-sm font-semibold text-ink-600 dark:text-ink-300">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading knowledge...
            </GlassCard>
          ) : knowledge.length ? (
            <div className="space-y-3">
              {knowledge.map((item) => (
                <GlassCard key={item.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={knowledgeTone[item.status]}>{item.status}</Badge>
                        <Badge tone={kindTone[item.kind]}>{item.kind}</Badge>
                        <Badge>confidence {Math.round(item.confidence * 100)}%</Badge>
                        {item.examSlug ? <Badge tone="violet">{item.examSlug}</Badge> : null}
                        {item.subject ? <Badge>{item.subject}</Badge> : null}
                        {item.topic ? <Badge>{item.topic}</Badge> : null}
                      </div>
                      <h3 className="mt-2 font-display text-lg font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">
                        {item.title}
                      </h3>
                      {item.summary ? (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">{item.summary}</p>
                      ) : null}
                      <p className="mt-1.5 text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                        {item.sourceName || "Manual paste"} · {formatDate(item.createdAt)}
                        {item.run ? ` · ${item.run.providerUsed}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-ink-900/[0.04] px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:bg-white/[0.06] dark:text-ink-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.status !== "PUBLISHED" && item.status !== "REJECTED" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handlePublish(item)}
                            disabled={busy === `publish:${item.id}`}
                            className={cn(primaryButton, "h-8 px-3 text-[11.5px]")}
                          >
                            {busy === `publish:${item.id}` ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3 w-3" aria-hidden />}
                            Publish
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReject(item)}
                            disabled={busy === `reject:${item.id}`}
                            className={cn(secondaryButton, "h-8 px-3 text-[11.5px]")}
                          >
                            {busy === `reject:${item.id}` ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
                            Reject
                          </button>
                        </>
                      ) : null}
                      {item.sourceUrl ? (
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className={cn(secondaryButton, "h-8 px-3 text-[11.5px]")}>
                          <ArrowUpRight className="h-3 w-3" aria-hidden />
                          Source
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <details className="mt-3 rounded-2xl border border-ink-900/[0.06] bg-white/40 px-3.5 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                    <summary className="cursor-pointer text-[11.5px] font-bold text-ink-700 dark:text-ink-200">
                      Read extracted content
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                      {item.content}
                    </p>
                  </details>
                </GlassCard>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              title="Nothing in this queue"
              description="Try a different status or kind, or run a source to create draft knowledge."
            />
          )}
        </div>
      ) : null}

      {!loading && tab === "ingest" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <GlassCard className="p-5 sm:p-6">
            <SectionHeading
              eyebrow="Manual ingestion"
              title="Paste source text"
              description="Use this for official notices that block bots, quick knowledge fixes, or question JSON. The same AI/heuristic pipeline and review queue apply."
              action={
                <button type="button" onClick={loadExample} className={cn(secondaryButton, "h-9 px-3.5 text-[12px]")}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Load example
                </button>
              }
            />
            <form onSubmit={handleManualIngest} className="space-y-3">
              <Field label="Source text">
                <textarea
                  required
                  rows={10}
                  value={manualForm.text}
                  onChange={(event) => setManualForm((current) => ({ ...current, text: event.target.value }))}
                  placeholder="Paste a notice, syllabus update, shortcut explanation, or a question..."
                  className={cn(inputClass, "min-h-[180px] resize-y py-3")}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title (optional)">
                  <input
                    value={manualForm.title}
                    onChange={(event) => setManualForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Extracted from first heading"
                    className={inputClass}
                  />
                </Field>
                <Field label="Kind">
                  <select
                    value={manualForm.kind}
                    onChange={(event) => setManualForm((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}
                    className={inputClass}
                  >
                    {KNOWLEDGE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Exam slug">
                  <input
                    value={manualForm.examSlug}
                    onChange={(event) => setManualForm((current) => ({ ...current, examSlug: event.target.value }))}
                    placeholder="ssc-cgl"
                    className={inputClass}
                  />
                </Field>
                <Field label="Tags (comma separated)">
                  <input
                    value={manualForm.tags}
                    onChange={(event) => setManualForm((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="polity, ssc-cgl"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Subject">
                  <input
                    value={manualForm.subject}
                    onChange={(event) => setManualForm((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="Quantitative Aptitude"
                    className={inputClass}
                  />
                </Field>
                <Field label="Topic">
                  <input
                    value={manualForm.topic}
                    onChange={(event) => setManualForm((current) => ({ ...current, topic: event.target.value }))}
                    placeholder="Percentages"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Extracted JSON (optional, for question papers)">
                <textarea
                  rows={5}
                  value={manualForm.extractedJson}
                  onChange={(event) => setManualForm((current) => ({ ...current, extractedJson: event.target.value }))}
                  placeholder='{"questions":[{"text":"...","options":[{"id":"A","text":"..."}],"correctOptionId":"A"}]}'
                  className={cn(inputClass, "min-h-[120px] resize-y py-3 font-mono text-[11px]")}
                />
              </Field>
              <button type="submit" disabled={busy === "manual"} className={cn(primaryButton, "h-10 w-full px-4 text-[12.5px]")}>
                {busy === "manual" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                Extract knowledge
              </button>
            </form>
          </GlassCard>

          <div className="space-y-5">
            <GlassCard className="p-5 sm:p-6">
              <SectionHeading eyebrow="How it works" title="Review, then publish" />
              <ol className="space-y-3 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                <li className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/12 text-[10px] font-bold text-brand-700 dark:text-brand-300">1</span>
                  Extraction creates DRAFT knowledge items. Nothing goes live automatically.
                </li>
                <li className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/12 text-[10px] font-bold text-brand-700 dark:text-brand-300">2</span>
                  Publish a LEARNING_TRICK to materialize it into the public shortcut lab.
                </li>
                <li className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/12 text-[10px] font-bold text-brand-700 dark:text-brand-300">3</span>
                  Publish a QUESTION with examSlug and extractedJson options to create a DRAFT paper.
                </li>
                <li className="flex gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500/12 text-[10px] font-bold text-brand-700 dark:text-brand-300">4</span>
                  Reject noisy items so they cannot be published later.
                </li>
              </ol>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <SectionHeading eyebrow="Safety" title="Operator note" />
              <p className="text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                This console mutates ingestion data and has no authentication layer yet. Keep it on a trusted network and do
                not expose it publicly until API auth is added.
              </p>
            </GlassCard>
          </div>
        </div>
      ) : null}

      {selectedRun ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/55 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Ingestion run detail"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="glass-strong max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400">Run detail</p>
                <h2 className="mt-1 font-display text-xl font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">
                  {selectedRun.source?.name || "Manual paste"}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={runTone[selectedRun.status]}>{selectedRun.status}</Badge>
                  <Badge tone="brand">{selectedRun.providerUsed}</Badge>
                  {selectedRun.httpStatus ? <Badge>HTTP {selectedRun.httpStatus}</Badge> : null}
                  <Badge tone="violet">{selectedRun.itemsFound} items</Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="press glass-soft grid h-9 w-9 place-items-center rounded-full text-ink-700 dark:text-ink-200"
                aria-label="Close run detail"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Started" value={formatDate(selectedRun.startedAt)} />
              <MiniStat label="Finished" value={formatDate(selectedRun.finishedAt)} />
              <MiniStat label="Created" value={String(selectedRun.itemsCreated)} />
              <MiniStat label="Updated" value={String(selectedRun.itemsUpdated)} />
            </div>

            {selectedRun.summary || selectedRun.errorMessage ? (
              <p className="mt-3 rounded-2xl border border-ink-900/[0.06] bg-white/45 px-3.5 py-3 text-[12px] font-medium text-ink-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-ink-300">
                {selectedRun.summary || selectedRun.errorMessage}
              </p>
            ) : null}

            {selectedRun.rawExcerpt ? (
              <details className="mt-3 rounded-2xl border border-ink-900/[0.06] bg-white/40 px-3.5 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <summary className="cursor-pointer text-[11.5px] font-bold text-ink-700 dark:text-ink-200">Raw excerpt</summary>
                <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
                  {selectedRun.rawExcerpt}
                </pre>
              </details>
            ) : null}

            <div className="mt-4">
              <h3 className="text-[12.5px] font-bold text-ink-900 dark:text-white">Extracted knowledge</h3>
              {selectedRun.knowledge.length ? (
                <div className="mt-2 space-y-2">
                  {selectedRun.knowledge.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-ink-900/[0.06] bg-white/45 p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={knowledgeTone[item.status]}>{item.status}</Badge>
                        <Badge tone={kindTone[item.kind]}>{item.kind}</Badge>
                        {item.examSlug ? <Badge tone="violet">{item.examSlug}</Badge> : null}
                      </div>
                      <p className="mt-1.5 text-[12.5px] font-bold text-ink-900 dark:text-white">{item.title}</p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600 dark:text-ink-300">{item.summary || item.content.slice(0, 240)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-ink-500 dark:text-ink-400">No knowledge items were created by this run.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-ink-900/10 bg-white/65 px-3 text-[12.5px] font-medium text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-ink-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-900/[0.05] bg-white/40 px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">{label}</p>
      <p className="mt-0.5 truncate text-[11.5px] font-bold text-ink-800 dark:text-ink-100">{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Activity;
  tone?: "neutral" | "brand" | "saffron" | "success";
}) {
  const tones = {
    neutral: "from-ink-900/[0.04] to-transparent text-ink-700 dark:text-ink-200",
    brand: "from-brand-500/15 to-transparent text-brand-700 dark:text-brand-300",
    saffron: "from-saffron-400/20 to-transparent text-saffron-800 dark:text-saffron-200",
    success: "from-emerald-500/15 to-transparent text-emerald-700 dark:text-emerald-300",
  } as const;

  return (
    <GlassCard className={cn("relative overflow-hidden p-4 sm:p-5")}>
      <div className={cn("absolute inset-0 bg-gradient-to-br", tones[tone])} aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">{label}</p>
          <Icon className="h-4 w-4 opacity-70" aria-hidden />
        </div>
        <p className="mt-2 font-display text-2xl font-extrabold tracking-[-0.03em] text-ink-900 dark:text-white">{value}</p>
        <p className="mt-0.5 text-[10.5px] font-medium text-ink-500 dark:text-ink-400">{hint}</p>
      </div>
    </GlassCard>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-ink-900/10 px-6 py-10 text-center dark:border-white/10">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ink-900/[0.04] text-ink-500 dark:bg-white/[0.06] dark:text-ink-300">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-[13px] font-bold text-ink-800 dark:text-ink-100">{title}</p>
      <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">{description}</p>
    </div>
  );
}
