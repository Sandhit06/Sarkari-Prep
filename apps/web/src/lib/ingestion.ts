const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export type IngestionSourceKind = "OFFICIAL_HTML" | "RSS_JSON" | "JSON_API" | "SITEMAP" | "MANUAL";
export type IngestionRunStatus =
  | "QUEUED"
  | "FETCHING"
  | "EXTRACTING"
  | "NEEDS_REVIEW"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";
export type KnowledgeKind =
  | "EXAM_UPDATE"
  | "NOTIFICATION"
  | "SYLLABUS"
  | "QUESTION"
  | "LEARNING_TRICK"
  | "STRATEGY";
export type KnowledgeStatus = "DRAFT" | "APPROVED" | "PUBLISHED" | "REJECTED";

export interface IngestionProvider {
  name: string;
  configured: boolean;
  model: string;
  baseUrl?: string | null;
}

export interface IngestionHealth {
  schedulerEnabled: boolean;
  configuredProvider: string;
  providers: IngestionProvider[];
  database: {
    sources: number;
    pendingKnowledge: number;
    runs: number;
    publishedKnowledge: number;
  };
}

export interface IngestionSource {
  id: string;
  slug: string;
  name: string;
  url: string;
  kind: IngestionSourceKind;
  examSlug: string | null;
  organizationSlug: string | null;
  enabled: boolean;
  cadenceMinutes: number;
  trustScore: number;
  lastRunAt: string | null;
  lastStatus: IngestionRunStatus | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { runs: number; knowledge: number };
}

export interface IngestionRunSummary {
  id: string;
  sourceId: string | null;
  status: IngestionRunStatus;
  providerUsed: string;
  httpStatus: number | null;
  fetchedUrl: string | null;
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  summary: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  source?: { id: string; slug: string; name: string; url?: string } | null;
  _count?: { knowledge: number };
}

export interface KnowledgeItem {
  id: string;
  slug: string;
  kind: KnowledgeKind;
  status: KnowledgeStatus;
  title: string;
  summary: string | null;
  content: string;
  examSlug: string | null;
  subject: string | null;
  topic: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  tags: string[];
  confidence: number;
  publishedAt: string | null;
  createdAt: string;
  source?: { id: string; slug: string; name: string } | null;
  run?: { id: string; providerUsed: string; status: IngestionRunStatus; startedAt: string } | null;
}

export interface IngestionRun extends IngestionRunSummary {
  contentHash: string | null;
  rawExcerpt: string | null;
  knowledge: KnowledgeItem[];
}

export interface RunsResponse {
  count: number;
  runs: IngestionRunSummary[];
}

export interface KnowledgeResponse {
  count: number;
  items: KnowledgeItem[];
}

export interface SourceInput {
  name: string;
  url: string;
  kind?: IngestionSourceKind;
  examSlug?: string;
  organizationSlug?: string;
  enabled?: boolean;
  cadenceMinutes?: number;
  trustScore?: number;
}

export interface ManualIngestInput {
  text: string;
  title?: string;
  url?: string;
  sourceName?: string;
  examSlug?: string;
  subject?: string;
  topic?: string;
  tags?: string[];
  kind?: KnowledgeKind;
  extractedJson?: unknown;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export function fetchIngestionHealth() {
  return request<IngestionHealth>("/ingestion/health");
}

export function fetchIngestionSources() {
  return request<IngestionSource[]>("/ingestion/sources");
}

export function fetchIngestionRuns(take = 25) {
  return request<RunsResponse>(`/ingestion/runs?take=${take}`);
}

export function fetchIngestionRun(id: string) {
  return request<IngestionRun>(`/ingestion/runs/${encodeURIComponent(id)}`);
}

export function fetchKnowledge(options: {
  status?: string;
  kind?: string;
  exam?: string;
  q?: string;
  take?: number;
} = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.kind) params.set("kind", options.kind);
  if (options.exam) params.set("exam", options.exam);
  if (options.q) params.set("q", options.q);
  params.set("take", String(options.take ?? 50));
  return request<KnowledgeResponse>(`/ingestion/knowledge?${params.toString()}`);
}

export function createIngestionSource(input: SourceInput) {
  return request<IngestionSource>("/ingestion/sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateIngestionSource(id: string, input: Partial<SourceInput>) {
  return request<IngestionSource>(`/ingestion/sources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function runIngestionSource(id: string, force = false) {
  return request<IngestionRun>(`/ingestion/sources/${encodeURIComponent(id)}/run`, {
    method: "POST",
    body: JSON.stringify({ force }),
  });
}

export function syncDueIngestionSources() {
  return request<{ checked: number; ran: number; runs: IngestionRunSummary[] }>("/ingestion/sync", {
    method: "POST",
  });
}

export function ingestManualKnowledge(input: ManualIngestInput) {
  return request<IngestionRun>("/ingestion/knowledge", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function publishKnowledgeItem(id: string) {
  return request<{ item: KnowledgeItem; materialized: Record<string, unknown> | null }>(
    `/ingestion/knowledge/${encodeURIComponent(id)}/publish`,
    { method: "POST" },
  );
}

export function rejectKnowledgeItem(id: string) {
  return request<KnowledgeItem>(`/ingestion/knowledge/${encodeURIComponent(id)}/reject`, {
    method: "POST",
  });
}
