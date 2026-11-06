import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ParsingStatus,
  Prisma,
  QuestionType,
  VerificationStatus,
  PaperSourceType,
} from '@prisma/client';

const PARSER_URL = (process.env.PARSER_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
const PARSER_TIMEOUT_MS = Number(process.env.PARSER_TIMEOUT_MS || 180_000);
const PARSER_STATUS_TIMEOUT_MS = Number(process.env.PARSER_STATUS_TIMEOUT_MS || 15_000);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'md',
  'markdown',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'tif',
  'tiff',
  'bmp',
]);

export interface UploadedDocument {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ParsedOption {
  id: string;
  text: string;
  textHindi?: string;
}

export interface ParsedQuestionPayload {
  questionNumber: number;
  text: string;
  textHindi?: string;
  options: ParsedOption[];
  questionType?: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'NUMERICAL' | string;
  correctOptionId?: string | null;
  correctOptionIds?: string[];
  correctNumericalAnswer?: number | null;
  numericalTolerance?: number | null;
  explanation?: string;
  subjectTag?: string;
  topicTag?: string;
  difficulty?: 'EASY' | 'MODERATE' | 'HARD';
  marks?: number;
  negativeMarks?: number;
  sourceConfidence?: number;
  needsHumanReview?: boolean;
}

export interface PublishPayload {
  examSlug: string;
  title: string;
  year: number;
  shift?: string;
  setSeries?: string;
  language?: string;
  sourceType?: PaperSourceType;
  durationMinutes: number;
  positiveMarks: number;
  negativeMarks: number;
  questions: ParsedQuestionPayload[];
}

export interface ManualJobPayload {
  fileName?: string;
  rawText: string;
  examSlug: string;
  year: number;
  title?: string;
  shift?: string;
  durationMinutes?: number;
  positiveMarks?: number;
  negativeMarks?: number;
  llmProvider?: string;
}

export interface UploadJobPayload {
  examSlug?: string;
  year?: string | number;
  title?: string;
  shift?: string;
  durationMinutes?: string | number;
  positiveMarks?: string | number;
  negativeMarks?: string | number;
  llmProvider?: string;
  uploaderId?: string;
}

interface ParserDraft {
  examSlug: string;
  year: number;
  title: string;
  shift?: string | null;
  setSeries?: string | null;
  durationMinutes: number;
  positiveMarks: number;
  negativeMarks: number;
  maximumMarks?: number;
  expectedQuestionCount?: number;
  language?: string;
  sourceType?: string;
  averageConfidence: number;
  questions: ParsedQuestionPayload[];
  warnings?: string[];
}

interface ParserJobResponse {
  jobId: string;
  status: string;
  progress?: number;
  stage?: string | null;
  stageLabel?: string | null;
  message?: string | null;
  fileName: string;
  fileType: string;
  extractionMethod?: string | null;
  charactersExtracted?: number;
  extractedQuestionCount?: number;
  averageConfidence?: number;
  stages?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  draft?: ParserDraft | null;
  errorMessage?: string | null;
}

function extensionOf(fileName: string): string {
  return fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'txt';
}

function asNumber(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asInteger(value: string | number | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function coerceText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(coerceText).join('\n');
  if (value && typeof value === 'object') {
    const nested = (value as { value?: unknown }).value;
    if (typeof nested === 'string') return nested;
  }
  return '';
}

@Injectable()
export class ParserBridgeService {
  private readonly logger = new Logger(ParserBridgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Parser transport
  // -------------------------------------------------------------------------

  private async parserFetch<T>(
    path: string,
    init?: RequestInit,
    timeoutMs = PARSER_TIMEOUT_MS,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${PARSER_URL}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.error(`Parser request failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The document parser is unreachable. Check that the parser service is running.',
      );
    }

    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { detail: text };
    }

    if (!response.ok) {
      const detail =
        typeof body?.detail === 'string'
          ? body.detail
          : Array.isArray(body?.detail)
            ? body.detail.map((item: any) => item.msg || JSON.stringify(item)).join('; ')
            : `Parser returned HTTP ${response.status}`;
      throw new BadGatewayException(detail);
    }

    return body as T;
  }

  async getParserHealth(): Promise<Record<string, unknown>> {
    try {
      return await this.parserFetch<Record<string, unknown>>('/health');
    } catch (error) {
      return {
        status: 'unreachable',
        error: (error as Error).message,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Job creation
  // -------------------------------------------------------------------------

  async createUploadJob(file: UploadedDocument, payload: UploadJobPayload) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Attach a PDF, DOCX, Markdown, text or image file.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `File is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
      );
    }

    const fileName = file.originalname || 'upload.txt';
    const extension = extensionOf(fileName);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        `Unsupported file type ".${extension}". Upload a PDF, DOCX, Markdown, text or image file.`,
      );
    }

    const examSlug = payload.examSlug || 'ssc-cgl';
    const year = asInteger(payload.year, new Date().getFullYear());
    const durationMinutes = asInteger(payload.durationMinutes, 60);
    const positiveMarks = asNumber(payload.positiveMarks, 2);
    const negativeMarks = asNumber(payload.negativeMarks, 0.5);

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' }),
      fileName,
    );
    form.append('exam_slug', examSlug);
    form.append('year', String(year));
    form.append('duration_minutes', String(durationMinutes));
    form.append('default_marks', String(positiveMarks));
    form.append('default_neg', String(negativeMarks));
    if (payload.title) form.append('title', payload.title);
    if (payload.shift) form.append('shift', payload.shift);
    if (payload.llmProvider) form.append('llm_provider', payload.llmProvider);

    const parsed = await this.parserFetch<ParserJobResponse>('/parse/async', {
      method: 'POST',
      body: form,
    });

    return this.persistParsedJob(parsed, {
      examSlug,
      year,
      title: payload.title,
      shift: payload.shift,
      durationMinutes,
      positiveMarks,
      negativeMarks,
      llmProvider: payload.llmProvider,
      uploaderId: payload.uploaderId,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
    });
  }

  async createManualJob(payload: ManualJobPayload) {
    const rawText = coerceText(payload.rawText).trim();
    if (rawText.length < 20) {
      throw new BadRequestException('Paste at least a few lines of paper text.');
    }

    const examSlug = payload.examSlug || 'ssc-cgl';
    const year = asInteger(payload.year, new Date().getFullYear());
    const durationMinutes = asInteger(payload.durationMinutes, 60);
    const positiveMarks = asNumber(payload.positiveMarks, 2);
    const negativeMarks = asNumber(payload.negativeMarks, 0.5);

    const parsed = await this.parserFetch<ParserJobResponse>('/parse/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: payload.fileName || 'manual-paste.md',
        rawText,
        examSlug,
        year,
        title: payload.title,
        shift: payload.shift,
        durationMinutes,
        positiveMarks,
        negativeMarks,
        llmProvider: payload.llmProvider,
      }),
    });

    return this.persistParsedJob(parsed, {
      examSlug,
      year,
      title: payload.title,
      shift: payload.shift,
      durationMinutes,
      positiveMarks,
      negativeMarks,
      llmProvider: payload.llmProvider,
      fileSizeBytes: Buffer.byteLength(rawText, 'utf8'),
      mimeType: 'text/markdown',
    });
  }

  private async persistParsedJob(
    parsed: ParserJobResponse,
    context: {
      examSlug: string;
      year: number;
      title?: string;
      shift?: string;
      durationMinutes: number;
      positiveMarks: number;
      negativeMarks: number;
      llmProvider?: string;
      uploaderId?: string;
      fileSizeBytes: number;
      mimeType?: string;
    },
  ) {
    const draft = parsed.draft ?? null;
    const questionCount = draft?.questions?.length ?? 0;
    const parserStatus = String(parsed.status || '').toUpperCase();
    const status = this.toParsingStatus(parserStatus, questionCount);

    const draftJson = {
      ...(draft ?? {}),
      examSlug: draft?.examSlug || context.examSlug,
      year: draft?.year || context.year,
      title: draft?.title || context.title || `${context.examSlug} ${context.year} Converted Paper`,
      shift: draft?.shift || context.shift || null,
      durationMinutes: draft?.durationMinutes || context.durationMinutes,
      positiveMarks: draft?.positiveMarks ?? context.positiveMarks,
      negativeMarks: draft?.negativeMarks ?? context.negativeMarks,
      parserJobId: parsed.jobId,
      parserStatus,
      progress: parsed.progress ?? (questionCount > 0 ? 100 : 0),
      stage: parsed.stage ?? parserStatus,
      stageLabel:
        parsed.stageLabel ?? (questionCount > 0 ? 'Ready for review' : 'Queued'),
      message: parsed.message ?? null,
      extractionMethod: parsed.extractionMethod ?? null,
      charactersExtracted: parsed.charactersExtracted ?? 0,
      fileSizeBytes: context.fileSizeBytes,
      mimeType: context.mimeType,
      stages: parsed.stages ?? null,
      metadata: parsed.metadata ?? null,
      warnings: draft?.warnings ?? [],
    } as unknown as Prisma.InputJsonValue;

    const job = await this.prisma.parsingJob.create({
      data: {
        fileName: parsed.fileName || 'upload.txt',
        fileType: parsed.fileType || extensionOf(parsed.fileName || 'upload.txt'),
        rawFileStorageKey: `parser://${parsed.jobId}`,
        status,
        llmProviderUsed: context.llmProvider || 'heuristic',
        uploaderId: context.uploaderId,
        extractedQuestionCount: questionCount,
        averageConfidence: draft?.averageConfidence ?? parsed.averageConfidence ?? 0,
        parsedDraftJson: draftJson,
        errorMessage:
          status === ParsingStatus.FAILED
            ? parsed.errorMessage ||
              'No numbered questions were detected. Try manual paste mode or a cleaner scan.'
            : null,
      },
    });

    return this.serializeJob(job);
  }

  // -------------------------------------------------------------------------
  // Job reads / review updates
  // -------------------------------------------------------------------------

  async listJobs(status?: string, take = 20) {
    const allowed = Object.values(ParsingStatus) as string[];
    const where =
      status && allowed.includes(status)
        ? { status: status as ParsingStatus }
        : undefined;

    const jobs = await this.prisma.parsingJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
      include: {
        paper: { select: { id: true, slug: true, title: true, verificationStatus: true } },
      },
    });

    return { count: jobs.length, jobs: jobs.map((job) => this.serializeJob(job)) };
  }

  async getJob(jobId: string) {
    let job = await this.prisma.parsingJob.findUnique({
      where: { id: jobId },
      include: {
        paper: {
          select: {
            id: true,
            slug: true,
            title: true,
            verificationStatus: true,
            _count: { select: { sections: true } },
          },
        },
      },
    });
    if (!job) throw new NotFoundException(`Parsing job "${jobId}" not found`);

    const draft = job.parsedDraftJson as unknown as ParserDraft | null;
    const parserJobId =
      draft && typeof (draft as { parserJobId?: unknown }).parserJobId === 'string'
        ? String((draft as { parserJobId?: unknown }).parserJobId)
        : null;
    const hasQuestions = Array.isArray(draft?.questions) && draft.questions.length > 0;
    const terminal =
      job.status === ParsingStatus.FAILED ||
      job.status === ParsingStatus.COMPLETED ||
      (job.status === ParsingStatus.NEEDS_REVIEW && hasQuestions);

    if (parserJobId && !job.paperId && !terminal) {
      try {
        const parsed = await this.parserFetch<ParserJobResponse>(
          `/parse/${parserJobId}`,
          undefined,
          PARSER_STATUS_TIMEOUT_MS,
        );
        job = await this.syncParserJob(job, parsed);
      } catch (error) {
        this.logger.warn(
          `Could not refresh parser job ${parserJobId}: ${(error as Error).message}`,
        );
      }
    }

    return this.serializeJob(job);
  }

  private async syncParserJob(job: any, parsed: ParserJobResponse) {
    const currentDraft = (job.parsedDraftJson as any) ?? {};
    const draft = parsed.draft ?? null;
    const questions = draft?.questions ?? [];
    const parserStatus = String(parsed.status || '').toUpperCase();
    const status = this.toParsingStatus(parserStatus, questions.length);

    const nextDraft = {
      ...currentDraft,
      ...(draft ?? {}),
      parserJobId: parsed.jobId,
      parserStatus,
      progress:
        typeof parsed.progress === 'number'
          ? parsed.progress
          : (currentDraft.progress ?? 0),
      stage: parsed.stage ?? parserStatus,
      stageLabel: parsed.stageLabel ?? currentDraft.stageLabel ?? null,
      message: parsed.message ?? currentDraft.message ?? null,
      extractionMethod:
        parsed.extractionMethod ?? currentDraft.extractionMethod ?? null,
      charactersExtracted:
        parsed.charactersExtracted ?? currentDraft.charactersExtracted ?? 0,
      stages: parsed.stages ?? currentDraft.stages ?? null,
      metadata: parsed.metadata ?? currentDraft.metadata ?? null,
      warnings: draft?.warnings ?? currentDraft.warnings ?? [],
    } as unknown as Prisma.InputJsonValue;

    return this.prisma.parsingJob.update({
      where: { id: job.id },
      data: {
        status,
        extractedQuestionCount: questions.length,
        averageConfidence:
          draft?.averageConfidence ?? parsed.averageConfidence ?? job.averageConfidence,
        parsedDraftJson: nextDraft,
        errorMessage:
          status === ParsingStatus.FAILED
            ? parsed.errorMessage ||
              'No numbered questions were detected. Try manual paste mode or a cleaner scan.'
            : null,
      },
      include: {
        paper: {
          select: {
            id: true,
            slug: true,
            title: true,
            verificationStatus: true,
            _count: { select: { sections: true } },
          },
        },
      },
    });
  }

  async updateJob(
    jobId: string,
    payload: {
      status?: ParsingStatus;
      title?: string;
      shift?: string;
      examSlug?: string;
      year?: number;
      durationMinutes?: number;
      positiveMarks?: number;
      negativeMarks?: number;
      questions?: ParsedQuestionPayload[];
    },
  ) {
    const job = await this.prisma.parsingJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Parsing job "${jobId}" not found`);
    if (job.paperId) {
      throw new ConflictException('This job has already been published and cannot be edited.');
    }

    const draft = (job.parsedDraftJson as unknown as ParserDraft | null) ?? ({} as ParserDraft);
    const questions = payload.questions ? this.validateQuestions(payload.questions) : draft.questions;

    const nextDraft: Prisma.InputJsonValue = {
      ...draft,
      ...(payload.title ? { title: payload.title } : {}),
      ...(payload.shift !== undefined ? { shift: payload.shift } : {}),
      ...(payload.examSlug ? { examSlug: payload.examSlug } : {}),
      ...(payload.year !== undefined ? { year: payload.year } : {}),
      ...(payload.durationMinutes !== undefined
        ? { durationMinutes: payload.durationMinutes }
        : {}),
      ...(payload.positiveMarks !== undefined
        ? { positiveMarks: payload.positiveMarks }
        : {}),
      ...(payload.negativeMarks !== undefined
        ? { negativeMarks: payload.negativeMarks }
        : {}),
      ...(questions ? { questions } : {}),
      averageConfidence: this.averageConfidence(questions ?? []),
    } as unknown as Prisma.InputJsonValue;

    const updated = await this.prisma.parsingJob.update({
      where: { id: jobId },
      data: {
        ...(payload.status ? { status: payload.status } : {}),
        ...(questions ? { extractedQuestionCount: questions.length } : {}),
        ...(questions ? { averageConfidence: this.averageConfidence(questions) } : {}),
        parsedDraftJson: nextDraft,
      },
    });

    return this.serializeJob(updated);
  }

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------

  async publishReviewedDraft(jobId: string, approvedPayload: PublishPayload) {
    const job = await this.prisma.parsingJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Parsing job "${jobId}" not found`);
    if (job.paperId) {
      throw new ConflictException('This parsing job has already been published.');
    }

    const draft = (job.parsedDraftJson as unknown as ParserDraft | null) ?? ({} as ParserDraft);

    const examSlug = approvedPayload.examSlug || draft.examSlug;
    const title = (approvedPayload.title || draft.title || '').trim();
    const year = asInteger(approvedPayload.year ?? draft.year, new Date().getFullYear());
    const durationMinutes = asInteger(
      approvedPayload.durationMinutes ?? draft.durationMinutes,
      60,
    );
    const positiveMarks = asNumber(
      approvedPayload.positiveMarks ?? draft.positiveMarks,
      2,
    );
    const negativeMarks = asNumber(
      approvedPayload.negativeMarks ?? draft.negativeMarks,
      0.5,
    );
    const questions = this.validateQuestions(
      approvedPayload.questions?.length ? approvedPayload.questions : draft.questions ?? [],
    );

    if (!examSlug) throw new BadRequestException('Choose the exam this paper belongs to.');
    if (!title) throw new BadRequestException('A paper title is required.');

    const exam = await this.prisma.exam.findUnique({ where: { slug: examSlug } });
    if (!exam) throw new NotFoundException(`Exam "${examSlug}" not found`);

    const totalMarks = questions.reduce(
      (sum, question) => sum + (question.marks ?? positiveMarks),
      0,
    );

    const paperSlug = `${examSlug}-${year}-${job.id.slice(-8)}`.toLowerCase();
    const answerMappings = Object.fromEntries(
      questions.map((question) => [
        String(question.questionNumber),
        question.questionType === 'NUMERICAL'
          ? question.correctNumericalAnswer
          : question.correctOptionIds?.join(',') || question.correctOptionId,
      ]),
    );

    const paper = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paper.create({
        data: {
          slug: paperSlug,
          title,
          examId: exam.id,
          year,
          shift: approvedPayload.shift || draft.shift || 'Converted paper',
          setSeries: approvedPayload.setSeries || draft.setSeries || null,
          language: approvedPayload.language || draft.language || 'en',
          isMock: false,
          isSectional: false,
          sourceType: approvedPayload.sourceType || PaperSourceType.USER_UPLOADED,
          verificationStatus: VerificationStatus.PUBLISHED,
          durationMinutes,
          totalMarks,
          hasSectionalTiming: exam.hasSectionalTiming,
          uploaderId: job.uploaderId,
          sections: {
            create: [
              {
                name: 'Converted Exam Paper',
                orderIndex: 1,
                positiveMarks,
                negativeMarks,
                questions: {
                  create: questions.map((question, index) => ({
                    questionNumber: question.questionNumber || index + 1,
                    text: question.text,
                    textHindi: question.textHindi,
                    type: question.questionType as QuestionType,
                    options: question.options as unknown as Prisma.InputJsonValue,
                    correctOptionId: question.correctOptionId ?? null,
                    correctOptionIds: question.correctOptionIds ?? [],
                    correctNumericalAnswer: question.correctNumericalAnswer ?? null,
                    numericalTolerance: question.numericalTolerance ?? null,
                    explanation: question.explanation,
                    subjectTag: question.subjectTag || 'General Awareness',
                    topicTag: question.topicTag || 'General',
                    difficulty: question.difficulty || 'MODERATE',
                    marks: question.marks ?? positiveMarks,
                    negativeMarks: question.negativeMarks ?? negativeMarks,
                    sourceConfidence: question.sourceConfidence ?? 1,
                    needsHumanReview: false,
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

      await tx.answerKey.create({
        data: {
          paperId: created.id,
          mappings: answerMappings as unknown as Prisma.InputJsonValue,
          isFinal: true,
        },
      });

      await tx.parsingJob.update({
        where: { id: job.id },
        data: {
          paperId: created.id,
          status: ParsingStatus.COMPLETED,
          extractedQuestionCount: questions.length,
          averageConfidence: this.averageConfidence(questions),
          errorMessage: null,
        },
      });

      return created;
    });

    return {
      ...paper,
      questionCount: questions.length,
      publishedAt: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toParsingStatus(status: string, questionCount: number): ParsingStatus {
    if (status === ParsingStatus.FAILED) return ParsingStatus.FAILED;
    if (status === ParsingStatus.COMPLETED) return ParsingStatus.COMPLETED;
    if (status === ParsingStatus.NEEDS_REVIEW) {
      return questionCount > 0 ? ParsingStatus.NEEDS_REVIEW : ParsingStatus.FAILED;
    }
    if (status === ParsingStatus.EXTRACTING_TEXT) return ParsingStatus.EXTRACTING_TEXT;
    if (status === ParsingStatus.IDENTIFYING_QUESTIONS) {
      return ParsingStatus.IDENTIFYING_QUESTIONS;
    }
    if (status === ParsingStatus.STRUCTURING_OPTIONS) {
      return ParsingStatus.STRUCTURING_OPTIONS;
    }
    return questionCount > 0 ? ParsingStatus.NEEDS_REVIEW : ParsingStatus.QUEUED;
  }

  private validateQuestions(questions: ParsedQuestionPayload[]): ParsedQuestionPayload[] {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new BadRequestException('At least one reviewed question is required to publish.');
    }

    return questions.map((question, index) => {
      const number = asInteger(question.questionNumber, index + 1);
      const text = (question.text || '').trim();
      if (!text) {
        throw new BadRequestException(`Question ${number} has no text.`);
      }

      const rawType = String(question.questionType || 'SINGLE_CHOICE').toUpperCase();
      const questionType: QuestionType =
        rawType === 'NUMERICAL' || rawType === 'NAT'
          ? QuestionType.NUMERICAL
          : rawType === 'MULTI_CHOICE' || rawType === 'MSQ'
            ? QuestionType.MULTI_CHOICE
            : QuestionType.SINGLE_CHOICE;

      if (questionType === QuestionType.NUMERICAL) {
        const numericalAnswer = Number(question.correctNumericalAnswer);
        if (!Number.isFinite(numericalAnswer)) {
          throw new BadRequestException(
            `Question ${number} needs a valid numerical answer.`,
          );
        }
        const tolerance = Number(question.numericalTolerance);
        return {
          ...question,
          questionNumber: number,
          text,
          options: [],
          questionType,
          correctOptionId: null,
          correctOptionIds: [],
          correctNumericalAnswer: numericalAnswer,
          numericalTolerance: Number.isFinite(tolerance) ? Math.abs(tolerance) : 0.01,
          subjectTag: question.subjectTag || 'General Awareness',
          topicTag: question.topicTag || 'General',
          sourceConfidence: question.sourceConfidence ?? 1,
        };
      }

      const options = (question.options || [])
        .filter((option) => option && option.id && option.text)
        .map((option) => ({
          id: String(option.id).toUpperCase(),
          text: String(option.text).trim(),
          ...(option.textHindi ? { textHindi: option.textHindi } : {}),
        }));

      if (options.length < 2) {
        throw new BadRequestException(`Question ${number} needs at least two options.`);
      }

      const candidateIds = (
        question.correctOptionIds?.length
          ? question.correctOptionIds
          : question.correctOptionId
            ? [question.correctOptionId]
            : []
      ).map((id) => String(id).toUpperCase());

      const correctOptionIds =
        questionType === QuestionType.MULTI_CHOICE
          ? Array.from(new Set(candidateIds))
          : candidateIds.slice(0, 1);

      if (correctOptionIds.length === 0) {
        throw new BadRequestException(`Question ${number} has no correct answer.`);
      }
      if (correctOptionIds.some((id) => !options.some((option) => option.id === id))) {
        throw new BadRequestException(
          `Question ${number} has an answer key that does not match any option.`,
        );
      }

      return {
        ...question,
        questionNumber: number,
        text,
        options,
        questionType,
        correctOptionId: correctOptionIds[0],
        correctOptionIds,
        correctNumericalAnswer: null,
        numericalTolerance: null,
        subjectTag: question.subjectTag || 'General Awareness',
        topicTag: question.topicTag || 'General',
        sourceConfidence: question.sourceConfidence ?? 1,
      };
    });
  }

  private averageConfidence(questions: ParsedQuestionPayload[]): number {
    if (!questions.length) return 0;
    const total = questions.reduce(
      (sum, question) => sum + (question.sourceConfidence ?? 0.85),
      0,
    );
    return Math.round((total / questions.length) * 100) / 100;
  }

  private serializeJob(job: any) {
    const draft = (job.parsedDraftJson as any) ?? null;
    const progress =
      typeof draft?.progress === 'number'
        ? draft.progress
        : job.status === ParsingStatus.NEEDS_REVIEW ||
            job.status === ParsingStatus.COMPLETED
          ? 100
          : 0;

    return {
      id: job.id,
      paperId: job.paperId,
      paper: job.paper ?? null,
      fileName: job.fileName,
      fileType: job.fileType,
      status: job.status,
      progress,
      stage: draft?.stage ?? null,
      stageLabel: draft?.stageLabel ?? null,
      message: draft?.message ?? null,
      parserJobId: draft?.parserJobId ?? null,
      llmProviderUsed: job.llmProviderUsed,
      extractedQuestionCount: job.extractedQuestionCount,
      averageConfidence: job.averageConfidence,
      parsedDraftJson: job.parsedDraftJson,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
