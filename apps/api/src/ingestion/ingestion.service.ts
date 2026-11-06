import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DifficultyLevel,
  IngestionRunStatus,
  IngestionSource,
  IngestionSourceKind,
  KnowledgeKind,
  KnowledgeStatus,
  PaperSourceType,
  Prisma,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExtractedKnowledgeItem,
  IngestionAiService,
} from './ingestion-ai.service';
import {
  asStringArray,
  clampText,
  contentHash,
  extractHtmlTitle,
  firstSentence,
  normalizeKind,
  slugify,
  toPlainText,
} from './ingestion.utils';

const FETCH_TIMEOUT_MS = Number(process.env.INGESTION_FETCH_TIMEOUT_MS || 25_000);
const MAX_SOURCE_RUNS = Number(process.env.INGESTION_MAX_SOURCE_RUNS || 5);

export interface SourceInput {
  slug?: string;
  name: string;
  kind?: string;
  url: string;
  examSlug?: string;
  organizationSlug?: string;
  enabled?: boolean;
  cadenceMinutes?: number;
  trustScore?: number;
  config?: unknown;
}

export interface ManualIngestInput {
  text: string;
  title?: string;
  url?: string;
  sourceId?: string;
  sourceName?: string;
  examSlug?: string;
  subject?: string;
  topic?: string;
  tags?: string[];
  kind?: string;
  extractedJson?: unknown;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: IngestionAiService,
  ) {}

  async health() {
    const [sources, pendingKnowledge, runs, publishedKnowledge] = await Promise.all([
      this.prisma.ingestionSource.count(),
      this.prisma.knowledgeItem.count({ where: { status: KnowledgeStatus.DRAFT } }),
      this.prisma.ingestionRun.count(),
      this.prisma.knowledgeItem.count({ where: { status: KnowledgeStatus.PUBLISHED } }),
    ]);

    return {
      ...this.ai.getProviderStatus(),
      database: { sources, pendingKnowledge, runs, publishedKnowledge },
    };
  }

  async listSources() {
    return this.prisma.ingestionSource.findMany({
      include: {
        _count: { select: { runs: true, knowledge: true } },
      },
      orderBy: [{ enabled: 'desc' }, { nextRunAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createSource(input: SourceInput) {
    const name = this.requiredString(input.name, 'Source name');
    const url = this.requiredString(input.url, 'Source URL');
    this.validateSourceUrl(url);
    const slug = slugify(input.slug || name, 'source');
    const existing = await this.prisma.ingestionSource.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Ingestion source "${slug}" already exists.`);

    return this.prisma.ingestionSource.create({
      data: {
        slug,
        name,
        url,
        kind: this.normalizeSourceKind(input.kind),
        examSlug: input.examSlug?.trim() || null,
        organizationSlug: input.organizationSlug?.trim() || null,
        enabled: input.enabled ?? true,
        cadenceMinutes: this.positiveInt(input.cadenceMinutes, 1440, 15, 43_200),
        trustScore: this.clamp(input.trustScore ?? 0.7, 0, 1),
        config: input.config ? (input.config as Prisma.InputJsonValue) : undefined,
        nextRunAt: input.enabled === false ? null : new Date(),
      },
      include: { _count: { select: { runs: true, knowledge: true } } },
    });
  }

  async updateSource(id: string, input: Partial<SourceInput>) {
    const source = await this.prisma.ingestionSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException(`Ingestion source "${id}" not found.`);

    const enabled = input.enabled ?? source.enabled;
    return this.prisma.ingestionSource.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: this.requiredString(input.name, 'Source name') } : {}),
        ...(input.url !== undefined
          ? { url: this.validatedSourceUrl(input.url) }
          : {}),
        ...(input.kind !== undefined ? { kind: this.normalizeSourceKind(input.kind) } : {}),
        ...(input.examSlug !== undefined ? { examSlug: input.examSlug.trim() || null } : {}),
        ...(input.organizationSlug !== undefined
          ? { organizationSlug: input.organizationSlug.trim() || null }
          : {}),
        enabled,
        ...(input.cadenceMinutes !== undefined
          ? { cadenceMinutes: this.positiveInt(input.cadenceMinutes, source.cadenceMinutes, 15, 43_200) }
          : {}),
        ...(input.trustScore !== undefined
          ? { trustScore: this.clamp(input.trustScore, 0, 1) }
          : {}),
        ...(input.config !== undefined
          ? { config: input.config as Prisma.InputJsonValue }
          : {}),
        ...(enabled && !source.nextRunAt ? { nextRunAt: new Date() } : {}),
        ...(!enabled ? { nextRunAt: null } : {}),
      },
      include: { _count: { select: { runs: true, knowledge: true } } },
    });
  }

  async runSource(id: string, options: { force?: boolean } = {}) {
    const source = await this.prisma.ingestionSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException(`Ingestion source "${id}" not found.`);
    if (!source.enabled && !options.force) {
      throw new BadRequestException('This ingestion source is disabled. Pass force=true to run it.');
    }
    return this.executeSource(source, options.force ?? false);
  }

  async runDueSources() {
    const due = await this.prisma.ingestionSource.findMany({
      where: {
        enabled: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
      },
      orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
      take: MAX_SOURCE_RUNS,
    });

    const runs: Awaited<ReturnType<IngestionService['getRun']>>[] = [];
    for (const source of due) {
      try {
        runs.push(await this.executeSource(source, false));
      } catch (error) {
        this.logger.warn(`Scheduled ingestion failed for ${source.slug}: ${(error as Error).message}`);
      }
    }

    return { checked: due.length, ran: runs.length, runs };
  }

  async ingestText(input: ManualIngestInput) {
    const text = clampText(input.text || '', 60_000);
    if (text.length < 20) {
      throw new BadRequestException('Paste at least a few lines of source text.');
    }

    const source = input.sourceId
      ? await this.prisma.ingestionSource.findUnique({ where: { id: input.sourceId } })
      : null;
    if (input.sourceId && !source) {
      throw new NotFoundException(`Ingestion source "${input.sourceId}" not found.`);
    }

    const run = await this.prisma.ingestionRun.create({
      data: {
        sourceId: source?.id,
        status: IngestionRunStatus.EXTRACTING,
        providerUsed: 'pending',
      },
    });

    try {
      const result = await this.ai.extract({
        text,
        url: input.url,
        title: input.title,
        examSlug: input.examSlug,
        sourceName: input.sourceName || source?.name || 'Manual paste',
        preferredKind: input.kind ? normalizeKind(input.kind) : undefined,
        extractedJson: input.extractedJson,
      });

      const counts = await this.persistKnowledge(run.id, source, result.items, {
        examSlug: input.examSlug,
        subject: input.subject,
        topic: input.topic,
        tags: input.tags,
        sourceName: input.sourceName || source?.name || 'Manual paste',
        sourceUrl: input.url || source?.url,
      });

      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: result.items.length
            ? IngestionRunStatus.NEEDS_REVIEW
            : IngestionRunStatus.COMPLETED,
          providerUsed: result.provider,
          itemsFound: result.items.length,
          itemsCreated: counts.created,
          itemsUpdated: counts.updated,
          summary: result.items.length
            ? `Extracted ${result.items.length} knowledge item(s) for review.`
            : 'No usable exam knowledge found in the pasted text.',
          rawExcerpt: text.slice(0, 2_000),
          finishedAt: new Date(),
        },
      });

      if (source) {
        await this.touchSource(source.id, run.id, result.items.length ? IngestionRunStatus.NEEDS_REVIEW : IngestionRunStatus.COMPLETED);
      }

      return this.getRun(run.id);
    } catch (error) {
      await this.failRun(run.id, source?.id, error);
      return this.getRun(run.id);
    }
  }

  async listRuns(options: { sourceId?: string; take?: number } = {}) {
    const take = Math.min(Math.max(options.take ?? 20, 1), 100);
    const runs = await this.prisma.ingestionRun.findMany({
      where: options.sourceId ? { sourceId: options.sourceId } : undefined,
      include: {
        source: { select: { id: true, slug: true, name: true } },
        _count: { select: { knowledge: true } },
      },
      orderBy: { startedAt: 'desc' },
      take,
    });
    return { count: runs.length, runs };
  }

  async getRun(id: string) {
    const run = await this.prisma.ingestionRun.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, slug: true, name: true, url: true } },
        knowledge: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) throw new NotFoundException(`Ingestion run "${id}" not found.`);
    return run;
  }

  async listKnowledge(
    options: {
      status?: string;
      kind?: string;
      exam?: string;
      q?: string;
      take?: number;
    } = {},
  ) {
    const take = Math.min(Math.max(options.take ?? 50, 1), 100);
    const status = options.status ? this.normalizeKnowledgeStatus(options.status) : undefined;
    const kind = options.kind ? this.normalizeKnowledgeKind(options.kind) : undefined;
    const search = options.q?.trim();

    const items = await this.prisma.knowledgeItem.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(kind ? { kind } : {}),
        ...(options.exam ? { examSlug: options.exam } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { summary: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        source: { select: { id: true, slug: true, name: true } },
        run: { select: { id: true, providerUsed: true, status: true, startedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return { count: items.length, items };
  }

  async publishKnowledge(id: string) {
    const item = await this.prisma.knowledgeItem.findUnique({
      where: { id },
      include: { source: true },
    });
    if (!item) throw new NotFoundException(`Knowledge item "${id}" not found.`);
    if (item.status === KnowledgeStatus.REJECTED) {
      throw new ConflictException('Rejected knowledge cannot be published.');
    }

    let materialized: Record<string, unknown> | null = null;
    if (item.kind === KnowledgeKind.LEARNING_TRICK) {
      materialized = await this.materializeLearningTrick(item);
    } else if (item.kind === KnowledgeKind.QUESTION) {
      materialized = await this.materializeQuestionPaper(item);
    }

    const published = await this.prisma.knowledgeItem.update({
      where: { id },
      data: {
        status: KnowledgeStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    return { item: published, materialized };
  }

  async rejectKnowledge(id: string) {
    const item = await this.prisma.knowledgeItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Knowledge item "${id}" not found.`);

    return this.prisma.knowledgeItem.update({
      where: { id },
      data: {
        status: KnowledgeStatus.REJECTED,
        publishedAt: null,
      },
    });
  }

  private async executeSource(source: IngestionSource, force: boolean) {
    const run = await this.prisma.ingestionRun.create({
      data: {
        sourceId: source.id,
        status: IngestionRunStatus.FETCHING,
        providerUsed: 'pending',
      },
    });

    try {
      const response = await fetch(source.url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml,application/json,text/plain,*/*',
          'User-Agent': 'SarkariPrepIngestionBot/1.0 (+https://sarkariprep.local)',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      const raw = await response.text();
      const hash = contentHash(raw);
      const httpStatus = response.status;

      if (!response.ok) {
        throw new Error(`Source returned HTTP ${httpStatus}.`);
      }

      const previous = await this.prisma.ingestionRun.findFirst({
        where: {
          sourceId: source.id,
          contentHash: hash,
          status: { in: [IngestionRunStatus.NEEDS_REVIEW, IngestionRunStatus.COMPLETED] },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (previous && !force) {
        await this.prisma.ingestionRun.update({
          where: { id: run.id },
          data: {
            status: IngestionRunStatus.SKIPPED,
            providerUsed: previous.providerUsed,
            httpStatus,
            fetchedUrl: response.url,
            contentHash: hash,
            summary: 'Source content is unchanged since the last successful run.',
            finishedAt: new Date(),
          },
        });
        await this.touchSource(source.id, run.id, IngestionRunStatus.SKIPPED);
        return this.getRun(run.id);
      }

      const plainText = toPlainText(raw);
      const result = await this.ai.extract({
        text: plainText,
        rawHtml: raw,
        url: response.url || source.url,
        title: extractHtmlTitle(raw) || source.name,
        examSlug: source.examSlug || undefined,
        sourceName: source.name,
      });

      const counts = await this.persistKnowledge(run.id, source, result.items, {
        sourceName: source.name,
        sourceUrl: response.url || source.url,
        examSlug: source.examSlug || undefined,
      });

      const status = result.items.length
        ? IngestionRunStatus.NEEDS_REVIEW
        : IngestionRunStatus.COMPLETED;

      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status,
          providerUsed: result.provider,
          httpStatus,
          fetchedUrl: response.url,
          contentHash: hash,
          itemsFound: result.items.length,
          itemsCreated: counts.created,
          itemsUpdated: counts.updated,
          summary: result.items.length
            ? `Extracted ${result.items.length} knowledge item(s) for review.`
            : 'Source fetched successfully, but no usable exam knowledge was found.',
          rawExcerpt: plainText.slice(0, 2_000),
          finishedAt: new Date(),
        },
      });

      await this.touchSource(source.id, run.id, status);
      return this.getRun(run.id);
    } catch (error) {
      await this.failRun(run.id, source.id, error);
      return this.getRun(run.id);
    }
  }

  private async persistKnowledge(
    runId: string,
    source: { id: string; slug: string; name: string; url: string } | null,
    items: ExtractedKnowledgeItem[],
    defaults: {
      examSlug?: string;
      subject?: string;
      topic?: string;
      tags?: string[];
      sourceName?: string;
      sourceUrl?: string;
    },
  ) {
    let created = 0;
    let updated = 0;

    for (const item of items) {
      const examSlug = item.examSlug || defaults.examSlug;
      const baseSlug = slugify(`${source?.slug || 'manual'}-${item.title}`, 'knowledge');
      const slug = `${baseSlug}-${contentHash(`${item.title}|${item.content}`).slice(0, 8)}`;
      const tags = Array.from(
        new Set([
          ...asStringArray(item.tags),
          ...asStringArray(defaults.tags),
          ...(examSlug ? [examSlug] : []),
        ]),
      );

      const data = {
        sourceId: source?.id ?? null,
        runId,
        kind: item.kind as KnowledgeKind,
        title: item.title,
        summary: item.summary || firstSentence(item.content),
        content: item.content,
        examSlug: examSlug || null,
        subject: item.subject || defaults.subject || null,
        topic: item.topic || defaults.topic || null,
        sourceUrl: item.sourceUrl || defaults.sourceUrl || source?.url || null,
        sourceName: defaults.sourceName || source?.name || 'Manual paste',
        tags,
        confidence: this.clamp(item.confidence ?? 0.6, 0, 1),
        extractedJson: item.extractedJson
          ? (item.extractedJson as Prisma.InputJsonValue)
          : undefined,
      };

      const existing = await this.prisma.knowledgeItem.findUnique({ where: { slug } });
      if (existing) {
        await this.prisma.knowledgeItem.update({
          where: { id: existing.id },
          data: {
            ...data,
            sourceId: existing.sourceId ?? data.sourceId,
          },
        });
        updated += 1;
      } else {
        await this.prisma.knowledgeItem.create({
          data: {
            slug,
            ...data,
            status: KnowledgeStatus.DRAFT,
          },
        });
        created += 1;
      }
    }

    return { created, updated };
  }

  private async materializeLearningTrick(item: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    content: string;
    examSlug: string | null;
    subject: string | null;
    topic: string | null;
    tags: string[];
    sourceUrl: string | null;
    extractedJson: Prisma.JsonValue | null;
  }) {
    const extracted = this.asRecord(item.extractedJson);
    const max = await this.prisma.learningTrick.aggregate({ _max: { sortOrder: true } });
    const payload = {
      title: item.title,
      subject: item.subject || this.asString(extracted.subject) || 'General Awareness',
      topic: item.topic || this.asString(extracted.topic) || 'Ingested Knowledge',
      examTags: item.tags.length ? item.tags : item.examSlug ? [item.examSlug] : [],
      shortcut: item.summary || firstSentence(item.content),
      explanation: item.content,
      example: this.asString(extracted.example) || null,
      exampleHindi: this.asString(extracted.exampleHindi) || null,
      mnemonic: this.asString(extracted.mnemonic) || null,
      difficulty: this.normalizeDifficulty(extracted.difficulty),
      accent: this.asString(extracted.accent) || 'brand',
      sourceUrl: item.sourceUrl,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      isPublished: true,
    };

    const trick = await this.prisma.learningTrick.upsert({
      where: { slug: item.slug },
      update: payload,
      create: { slug: item.slug, ...payload },
    });

    return { type: 'learning-trick', id: trick.id, slug: trick.slug };
  }

  private async materializeQuestionPaper(item: {
    slug: string;
    title: string;
    examSlug: string | null;
    subject: string | null;
    topic: string | null;
    content: string;
    extractedJson: Prisma.JsonValue | null;
  }) {
    if (!item.examSlug) {
      throw new BadRequestException('Question knowledge needs an examSlug before it can become a paper.');
    }

    const exam = await this.prisma.exam.findUnique({ where: { slug: item.examSlug } });
    if (!exam) throw new NotFoundException(`Exam "${item.examSlug}" not found.`);

    const extracted = this.asRecord(item.extractedJson);
    const rawQuestions = Array.isArray(extracted.questions)
      ? extracted.questions
      : [extracted];
    const questions = rawQuestions
      .map((entry, index) => this.normalizeQuestion(entry, index, item))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    if (!questions.length) {
      throw new BadRequestException(
        'Question knowledge needs options and a correctOptionId in extractedJson.',
      );
    }

    const slug = `ingested-${item.slug}`;
    const existing = await this.prisma.paper.findUnique({ where: { slug } });
    if (existing) {
      return { type: 'paper', id: existing.id, slug: existing.slug, existing: true };
    }

    const paper = await this.prisma.paper.create({
      data: {
        slug,
        title: item.title,
        examId: exam.id,
        year: new Date().getFullYear(),
        shift: 'Ingested knowledge',
        language: 'en',
        isMock: false,
        isSectional: false,
        sourceType: PaperSourceType.MEMORY_BASED,
        verificationStatus: VerificationStatus.DRAFT,
        durationMinutes: 15,
        totalMarks: questions.length,
        hasSectionalTiming: false,
        sections: {
          create: [
            {
              name: 'Ingested Questions',
              orderIndex: 1,
              positiveMarks: 1,
              negativeMarks: exam.defaultNegativeMark,
              questions: {
                create: questions.map((question) => ({
                  questionNumber: question.questionNumber,
                  text: question.text,
                  options: question.options as unknown as Prisma.InputJsonValue,
                  correctOptionId: question.correctOptionId,
                  explanation: question.explanation,
                  subjectTag: question.subjectTag,
                  topicTag: question.topicTag,
                  difficulty: question.difficulty,
                  marks: 1,
                  negativeMarks: exam.defaultNegativeMark,
                  sourceConfidence: question.sourceConfidence,
                  needsHumanReview: true,
                })),
              },
            },
          ],
        },
      },
      include: {
        exam: { select: { id: true, slug: true, shortName: true } },
        sections: { select: { id: true, name: true, _count: { select: { questions: true } } } },
      },
    });

    return { type: 'paper', id: paper.id, slug: paper.slug, existing: false };
  }

  private normalizeQuestion(
    entry: unknown,
    index: number,
    item: {
      title: string;
      subject: string | null;
      topic: string | null;
      content: string;
    },
  ) {
    if (!entry || typeof entry !== 'object') return null;
    const question = entry as Record<string, unknown>;
    const text = this.asString(question.text) || (index === 0 ? item.content : '');
    if (!text) return null;

    const options = Array.isArray(question.options)
      ? question.options
          .map((option) => {
            if (!option || typeof option !== 'object') return null;
            const value = option as Record<string, unknown>;
            const id = this.asString(value.id).toUpperCase();
            const optionText = this.asString(value.text);
            return id && optionText ? { id, text: optionText } : null;
          })
          .filter((option): option is { id: string; text: string } => Boolean(option))
      : [];

    const correctOptionId = this.asString(question.correctOptionId).toUpperCase();
    if (options.length < 2 || !options.some((option) => option.id === correctOptionId)) {
      return null;
    }

    return {
      questionNumber: Number.isInteger(question.questionNumber)
        ? Number(question.questionNumber)
        : index + 1,
      text,
      options,
      correctOptionId,
      explanation: this.asString(question.explanation) || null,
      subjectTag: this.asString(question.subjectTag) || item.subject || 'General Awareness',
      topicTag: this.asString(question.topicTag) || item.topic || 'Ingested',
      difficulty: this.normalizeDifficulty(question.difficulty),
      sourceConfidence: this.clamp(
        typeof question.sourceConfidence === 'number' ? question.sourceConfidence : 0.6,
        0,
        1,
      ),
    };
  }

  private async touchSource(sourceId: string, runId: string, status: IngestionRunStatus) {
    const source = await this.prisma.ingestionSource.findUnique({ where: { id: sourceId } });
    if (!source) return;
    const now = new Date();
    await this.prisma.ingestionSource.update({
      where: { id: sourceId },
      data: {
        lastRunAt: now,
        lastStatus: status,
        nextRunAt: new Date(now.getTime() + source.cadenceMinutes * 60_000),
      },
    });
    this.logger.log(`Ingestion source ${source.slug} finished run ${runId} with ${status}.`);
  }

  private async failRun(runId: string, sourceId: string | undefined, error: unknown) {
    const message = (error as Error).message || 'Unknown ingestion error';
    this.logger.warn(`Ingestion run ${runId} failed: ${message}`);
    await this.prisma.ingestionRun.update({
      where: { id: runId },
      data: {
        status: IngestionRunStatus.FAILED,
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
    if (sourceId) {
      await this.touchSource(sourceId, runId, IngestionRunStatus.FAILED);
    }
  }

  private normalizeSourceKind(value: string | undefined): IngestionSourceKind {
    if (!value) return IngestionSourceKind.OFFICIAL_HTML;
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    return (Object.values(IngestionSourceKind) as string[]).includes(normalized)
      ? (normalized as IngestionSourceKind)
      : IngestionSourceKind.OFFICIAL_HTML;
  }

  private normalizeKnowledgeKind(value: string): KnowledgeKind {
    return normalizeKind(value) as KnowledgeKind;
  }

  private normalizeKnowledgeStatus(value: string): KnowledgeStatus {
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    return (Object.values(KnowledgeStatus) as string[]).includes(normalized)
      ? (normalized as KnowledgeStatus)
      : KnowledgeStatus.DRAFT;
  }

  private normalizeDifficulty(value: unknown): DifficultyLevel {
    const normalized = this.asString(value).toUpperCase();
    return (Object.values(DifficultyLevel) as string[]).includes(normalized)
      ? (normalized as DifficultyLevel)
      : DifficultyLevel.MODERATE;
  }

  private requiredString(value: string | undefined, label: string): string {
    const text = (value || '').trim();
    if (!text) throw new BadRequestException(`${label} is required.`);
    return text;
  }

  private validateSourceUrl(value: string) {
    if (!/^https?:\/\//i.test(value)) {
      throw new BadRequestException('Source URL must start with http:// or https://.');
    }
  }

  private validatedSourceUrl(value: string): string {
    const url = this.requiredString(value, 'Source URL');
    this.validateSourceUrl(url);
    return url;
  }

  private positiveInt(value: number | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.round(value), min), max);
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
