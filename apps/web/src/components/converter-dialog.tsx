"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Loader2,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import { Badge, ProgressBar, primaryButton, secondaryButton } from "@/components/ui";
import { exams, type Exam } from "@/lib/data";
import { cn } from "@/lib/cn";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ".pdf,.docx,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp";
const CURRENT_YEAR = new Date().getFullYear();

const SAMPLE_PAPER = `# Exam: ssc-cgl
# Year: 2024
# Shift: Tier-I Shift 1
# Duration: 60
# Marks: +2.0, -0.50

Q1. Which Article of the Constitution of India provides for the appointment of a Finance Commission?
(A) Article 275
(B) Article 280
(C) Article 300A
(D) Article 315
Ans: B
Subject: General Awareness
Topic: Indian Polity — Constitutional Bodies
Explanation: Article 280 requires the President to constitute a Finance Commission every five years.

Q2. If the ratio of cost price to selling price of an article is 5 : 6, what is the profit percentage?
(A) 16.67%
(B) 20%
(C) 25%
(D) 15%
Ans: B
Subject: Quantitative Aptitude
Topic: Profit and Loss
Explanation: Profit % = ((6 - 5) / 5) * 100 = 20%.

Q3. Select the synonym of the word "Abundant".
(A) Scarce
(B) Plentiful
(C) Fragile
(D) Rapid
Ans: B
Subject: English Language
Topic: Synonyms`;

type QuestionOption = {
  id: string;
  text: string;
  textHindi?: string | null;
};

type DraftQuestion = {
  questionNumber: number;
  text: string;
  textHindi?: string | null;
  options: QuestionOption[];
  questionType?: "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERICAL";
  correctOptionId?: string | null;
  correctOptionIds?: string[];
  correctNumericalAnswer?: number | null;
  numericalTolerance?: number | null;
  explanation?: string | null;
  subjectTag?: string;
  topicTag?: string;
  difficulty?: string;
  marks?: number;
  negativeMarks?: number;
  sourceConfidence?: number;
  needsHumanReview?: boolean;
};

type ParsedDraft = {
  examSlug?: string;
  year?: number;
  title?: string;
  shift?: string | null;
  setSeries?: string | null;
  durationMinutes?: number;
  positiveMarks?: number;
  negativeMarks?: number;
  maximumMarks?: number;
  expectedQuestionCount?: number;
  averageConfidence?: number;
  extractionMethod?: string;
  warnings?: string[];
  questions?: DraftQuestion[];
};

type ParsingJob = {
  id: string;
  paperId?: string | null;
  paper?: { id: string; slug: string; title: string } | null;
  fileName: string;
  fileType: string;
  status: string;
  progress?: number;
  stage?: string | null;
  stageLabel?: string | null;
  message?: string | null;
  extractedQuestionCount: number;
  averageConfidence: number;
  parsedDraftJson: ParsedDraft | null;
  errorMessage?: string | null;
};

type Step = "details" | "processing" | "review" | "done";

function questionTypeOf(question: DraftQuestion): "SINGLE_CHOICE" | "MULTI_CHOICE" | "NUMERICAL" {
  if (question.questionType) return question.questionType;
  if (question.correctNumericalAnswer != null) return "NUMERICAL";
  if ((question.correctOptionIds?.length ?? 0) > 1) return "MULTI_CHOICE";
  return "SINGLE_CHOICE";
}

function hasAnswerKey(question: DraftQuestion): boolean {
  const type = questionTypeOf(question);
  if (type === "NUMERICAL") return Number.isFinite(question.correctNumericalAnswer);
  if (type === "MULTI_CHOICE") return (question.correctOptionIds?.length ?? 0) > 0;
  return question.options.some((option) => option.id === question.correctOptionId);
}

const PIPELINE_STEPS = [
  { key: "EXTRACTING_TEXT", label: "Read & OCR" },
  { key: "IDENTIFYING_QUESTIONS", label: "Find questions" },
  { key: "STRUCTURING_OPTIONS", label: "Structure options" },
  { key: "NEEDS_REVIEW", label: "Ready" },
] as const;

type ConverterDialogProps = {
  open: boolean;
  onClose: () => void;
  initialFile?: File | null;
};

type ConverterExam = {
  slug: string;
  shortName: string;
  name: string;
  category: Exam["category"];
  durationMins: number;
  negativeMark: number;
  totalMarks: number;
};

const EXAM_CATEGORIES: Array<Exam["category"]> = [
  "SSC",
  "UPSC",
  "BANKING",
  "RAILWAYS",
  "STATE_PSC",
  "TEACHING",
  "DEFENCE",
  "ENGINEERING",
];

const FALLBACK_EXAMS: ConverterExam[] = exams.map((exam) => ({
  slug: exam.slug,
  shortName: exam.shortName,
  name: exam.name,
  category: exam.category,
  durationMins: exam.durationMins,
  negativeMark: exam.negativeMark,
  totalMarks: exam.totalMarks,
}));

function toExamCategory(value: unknown): Exam["category"] {
  return EXAM_CATEGORIES.includes(value as Exam["category"])
    ? (value as Exam["category"])
    : "SSC";
}

function defaultPositiveMarks(exam: ConverterExam): number {
  switch (exam.category) {
    case "BANKING":
    case "RAILWAYS":
    case "STATE_PSC":
    case "TEACHING":
    case "ENGINEERING":
      return 1;
    case "DEFENCE":
      return 2.5;
    default:
      return 2;
  }
}

function defaultTitle(exam: ConverterExam, year: number, shift: string): string {
  return `${exam.shortName} ${year}${shift.trim() ? ` — ${shift.trim()}` : ""}`;
}

function extensionOf(fileName: string): string {
  return fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
}

function confidenceTone(confidence: number | undefined): {
  tone: "success" | "saffron" | "danger";
  label: string;
} {
  if ((confidence ?? 0) >= 0.85) return { tone: "success", label: "High confidence" };
  if ((confidence ?? 0) >= 0.65) return { tone: "saffron", label: "Check this" };
  return { tone: "danger", label: "Low confidence" };
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  const message = body?.message ?? body?.detail ?? body?.error;
  if (Array.isArray(message)) return message.join("; ");
  if (typeof message === "string") return message;
  return `Request failed with HTTP ${response.status}.`;
}

export function ConverterDialog({ open, onClose, initialFile }: ConverterDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [step, setStep] = useState<Step>("details");
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialExam = FALLBACK_EXAMS[0];
  const [examOptions, setExamOptions] = useState<ConverterExam[]>(FALLBACK_EXAMS);
  const [examSlug, setExamSlug] = useState(initialExam.slug);
  const [year, setYear] = useState(CURRENT_YEAR - 1);
  const [title, setTitle] = useState(defaultTitle(initialExam, CURRENT_YEAR - 1, "Tier-I Shift 1"));
  const [shift, setShift] = useState("Tier-I Shift 1");
  const [durationMinutes, setDurationMinutes] = useState(initialExam.durationMins);
  const [positiveMarks, setPositiveMarks] = useState(defaultPositiveMarks(initialExam));
  const [negativeMarks, setNegativeMarks] = useState(initialExam.negativeMark);

  const [job, setJob] = useState<ParsingJob | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [progress, setProgress] = useState(0);
  const [stageKey, setStageKey] = useState("QUEUED");
  const [stageLabel, setStageLabel] = useState("Queued");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ slug: string; title: string; questionCount: number } | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const examSlugRef = useRef(examSlug);
  const yearRef = useRef(year);
  const shiftRef = useRef(shift);

  useEffect(() => {
    examSlugRef.current = examSlug;
  }, [examSlug]);

  useEffect(() => {
    yearRef.current = year;
  }, [year]);

  useEffect(() => {
    shiftRef.current = shift;
  }, [shift]);

  const selectedExam = useMemo(
    () => examOptions.find((exam) => exam.slug === examSlug) ?? examOptions[0] ?? initialExam,
    [examOptions, examSlug, initialExam],
  );

  useEffect(() => setMounted(true), []);

  // Use the exams that actually exist in the database so publishing never
  // fails with "Exam not found". The static list is only a fallback for a
  // cold API (the converter still needs to render).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/exams`, { cache: "no-store" });
        if (!response.ok) return;

        const body = await response.json();
        const list = Array.isArray(body) ? body : Array.isArray(body?.exams) ? body.exams : [];
        const mapped: ConverterExam[] = list
          .filter((item: any) => item && typeof item.slug === "string" && item.slug)
          .map((item: any) => ({
            slug: String(item.slug),
            shortName: String(item.shortName || item.name || item.slug),
            name: String(item.name || item.shortName || item.slug),
            category: toExamCategory(item.category),
            durationMins: Number(item.defaultDurationMins) || 60,
            negativeMark: Number(item.defaultNegativeMark) || 0,
            totalMarks: Number(item.defaultTotalMarks) || 0,
          }));

        if (cancelled || mapped.length === 0) return;
        setExamOptions(mapped);

        if (!mapped.some((exam) => exam.slug === examSlugRef.current)) {
          const first = mapped[0];
          setExamSlug(first.slug);
          setDurationMinutes(first.durationMins);
          setNegativeMarks(first.negativeMark);
          setPositiveMarks(defaultPositiveMarks(first));
          setTitle(defaultTitle(first, yearRef.current, shiftRef.current));
        }
      } catch {
        // Keep the static fallback when the API is offline.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep("details");
    setError(null);
    setJob(null);
    setQuestions([]);
    setProgress(0);
    setStageKey("QUEUED");
    setStageLabel("Queued");
    setPublished(null);
    setEditingQuestion(null);
    setFlaggedOnly(false);
    setPasteText("");
    if (initialFile) {
      setMode("upload");
      setFile(initialFile);
    } else {
      setMode("upload");
      setFile(null);
    }
  }, [open, initialFile]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && step !== "processing" && !publishing) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, step, publishing]);

  const applyExamDefaults = useCallback((slug: string) => {
    const exam = examOptions.find((item) => item.slug === slug);
    if (!exam) return;
    setExamSlug(exam.slug);
    setDurationMinutes(exam.durationMins);
    setNegativeMarks(exam.negativeMark);
    setPositiveMarks(defaultPositiveMarks(exam));
    setTitle(defaultTitle(exam, year, shift));
  }, [examOptions, year, shift]);

  const applyParsedDraft = useCallback(
    (nextJob: ParsingJob, extracted: DraftQuestion[]) => {
      const draft = nextJob.parsedDraftJson ?? {};
      const normalised = extracted.map((question) => {
        const questionType = questionTypeOf(question);
        const correctOptionIds =
          question.correctOptionIds?.length
            ? question.correctOptionIds
            : question.correctOptionId
              ? [question.correctOptionId]
              : [];
        return {
          ...question,
          questionType,
          correctOptionIds,
          correctOptionId: question.correctOptionId ?? correctOptionIds[0] ?? null,
        };
      });
      setJob(nextJob);
      setQuestions(normalised);
      setProgress(100);
      setStageKey("NEEDS_REVIEW");
      setStageLabel("Ready for review");
      setError(null);
      if (draft.examSlug) setExamSlug(draft.examSlug);
      if (draft.year) setYear(draft.year);
      if (draft.title) setTitle(draft.title);
      if (draft.shift) setShift(draft.shift);
      if (draft.durationMinutes) setDurationMinutes(draft.durationMinutes);
      if (typeof draft.positiveMarks === "number") setPositiveMarks(draft.positiveMarks);
      if (typeof draft.negativeMarks === "number") setNegativeMarks(draft.negativeMarks);
      setStep("review");
    },
    [],
  );

  useEffect(() => {
    if (step !== "processing" || !job?.id) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let failures = 0;

    const poll = async () => {
      if (cancelled) return;

      try {
        const response = await fetch(`${API_BASE}/parser/jobs/${job.id}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await readError(response));

        const next = (await response.json()) as ParsingJob;
        if (cancelled) return;

        failures = 0;
        setProgress(typeof next.progress === "number" ? next.progress : 0);
        setStageKey(next.status);
        setStageLabel(next.stageLabel || next.message || "Working…");

        const draft = next.parsedDraftJson ?? {};
        const extracted = draft.questions ?? [];

        if (next.status === "FAILED") {
          setError(next.errorMessage || "The converter could not read this paper.");
          setJob(null);
          setStep("details");
          return;
        }

        if (
          extracted.length > 0 &&
          (next.status === "NEEDS_REVIEW" || next.status === "COMPLETED")
        ) {
          applyParsedDraft(next, extracted);
          return;
        }

        if (next.status === "NEEDS_REVIEW" && extracted.length === 0) {
          setError(
            next.errorMessage ||
              "No questions were detected. Check the scan quality or paste the paper as Markdown.",
          );
          setJob(null);
          setStep("details");
          return;
        }

        if (Date.now() - startedAt > 5 * 60 * 1000) {
          setError(
            "This paper is taking too long to convert. Try a smaller file or paste the paper text.",
          );
          setJob(null);
          setStep("details");
          return;
        }

        timer = setTimeout(poll, 1500);
      } catch (caught) {
        if (cancelled) return;
        failures += 1;
        if (failures >= 5) {
          setError(`Lost connection while converting: ${(caught as Error).message}`);
          setJob(null);
          setStep("details");
          return;
        }
        timer = setTimeout(poll, 2500);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [step, job?.id, applyParsedDraft]);

  const handleYearChange = (nextYear: number) => {
    setYear(nextYear);
    setTitle(defaultTitle(selectedExam, nextYear, shift));
  };

  const handleShiftChange = (nextShift: string) => {
    setShift(nextShift);
    setTitle(defaultTitle(selectedExam, year, nextShift));
  };

  const acceptFile = (candidate: File | null | undefined) => {
    if (!candidate) return;
    const extension = extensionOf(candidate.name);
    if (!ACCEPTED_EXTENSIONS.split(",").includes(`.${extension}`)) {
      setError("That file type is not supported. Use PDF, DOCX, Markdown, TXT or an image.");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError("That file is larger than 25 MB.");
      return;
    }
    setError(null);
    setFile(candidate);
    setMode("upload");
  };

  const submit = async () => {
    if (mode === "upload" && !file) {
      setError("Choose a paper to convert first.");
      return;
    }
    if (mode === "paste" && pasteText.trim().length < 20) {
      setError("Paste at least a few lines of paper text.");
      return;
    }

    setError(null);
    setJob(null);
    setProgress(3);
    setStageKey("QUEUED");
    setStageLabel("Uploading paper…");
    setStep("processing");

    try {
      let response: Response;
      if (mode === "upload" && file) {
        const form = new FormData();
        form.append("file", file);
        form.append("examSlug", examSlug);
        form.append("year", String(year));
        form.append("title", title);
        form.append("shift", shift);
        form.append("durationMinutes", String(durationMinutes));
        form.append("positiveMarks", String(positiveMarks));
        form.append("negativeMarks", String(negativeMarks));

        response = await fetch(`${API_BASE}/parser/jobs`, { method: "POST", body: form });
      } else {
        response = await fetch(`${API_BASE}/parser/jobs/manual`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "manual-paste.md",
            rawText: pasteText,
            examSlug,
            year,
            title,
            shift,
            durationMinutes,
            positiveMarks,
            negativeMarks,
          }),
        });
      }

      if (!response.ok) throw new Error(await readError(response));

      const created = (await response.json()) as ParsingJob;
      const draft = created.parsedDraftJson ?? {};
      const extracted = draft.questions ?? [];

      if (created.status === "FAILED") {
        throw new Error(
          created.errorMessage ||
            "The converter could not read this paper. Check the scan quality or paste the text.",
        );
      }

      if (created.status === "NEEDS_REVIEW" && extracted.length === 0) {
        throw new Error(
          created.errorMessage ||
            "No questions were detected. Check the scan quality or paste the paper as Markdown.",
        );
      }

      if (extracted.length > 0) {
        applyParsedDraft(created, extracted);
        return;
      }

      setJob(created);
      setProgress(typeof created.progress === "number" ? created.progress : 4);
      setStageKey(created.status);
      setStageLabel(created.stageLabel || created.message || "Preparing the paper…");
    } catch (caught) {
      setError((caught as Error).message);
      setJob(null);
      setStep("details");
    }
  };

  const publish = async () => {
    if (!job) return;
    if (!questions.length) {
      setError("Add at least one question before publishing.");
      return;
    }

    const missingAnswer = questions.find((question) => !hasAnswerKey(question));
    if (missingAnswer) {
      setError(`Question ${missingAnswer.questionNumber} needs a correct answer.`);
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/parser/jobs/${job.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examSlug,
          title,
          year,
          shift,
          durationMinutes,
          positiveMarks,
          negativeMarks,
          questions: questions.map((question) => ({
            questionNumber: question.questionNumber,
            text: question.text,
            textHindi: question.textHindi,
            options: question.options.map((option) => ({
              id: option.id,
              text: option.text,
              textHindi: option.textHindi,
            })),
            questionType: questionTypeOf(question),
            correctOptionId: question.correctOptionId,
            correctOptionIds: question.correctOptionIds,
            correctNumericalAnswer: question.correctNumericalAnswer,
            numericalTolerance: question.numericalTolerance,
            explanation: question.explanation,
            subjectTag: question.subjectTag,
            topicTag: question.topicTag,
            difficulty: question.difficulty,
            marks: question.marks,
            negativeMarks: question.negativeMarks,
            sourceConfidence: question.sourceConfidence,
          })),
        }),
      });

      if (!response.ok) throw new Error(await readError(response));

      const paper = await response.json();
      setPublished({
        slug: paper.slug,
        title: paper.title,
        questionCount: paper.questionCount ?? questions.length,
      });
      setStep("done");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const resetForAnother = () => {
    setStep("details");
    setFile(null);
    setPasteText("");
    setJob(null);
    setQuestions([]);
    setProgress(0);
    setStageKey("QUEUED");
    setStageLabel("Queued");
    setPublished(null);
    setError(null);
    setMode("upload");
  };

  const updateQuestion = (questionNumber: number, patch: Partial<DraftQuestion>) => {
    setQuestions((current) =>
      current.map((question) =>
        question.questionNumber === questionNumber ? { ...question, ...patch } : question,
      ),
    );
  };

  const removeQuestion = (questionNumber: number) => {
    setQuestions((current) =>
      current.filter((question) => question.questionNumber !== questionNumber),
    );
  };

  const flaggedCount = questions.filter(
    (question) => question.needsHumanReview || (question.sourceConfidence ?? 1) < 0.85,
  ).length;

  const visibleQuestions = flaggedOnly
    ? questions.filter(
        (question) => question.needsHumanReview || (question.sourceConfidence ?? 1) < 0.85,
      )
    : questions;

  const answeredCount = questions.filter(hasAnswerKey).length;

  if (!mounted || !open) return null;

  const stepIndex = step === "done" ? 2 : step === "review" ? 1 : 0;
  const steps = ["Paper & details", "Review questions", "Publish"];
  const activeStageIndex =
    stageKey === "NEEDS_REVIEW" ? 3 : progress >= 66 ? 2 : progress >= 8 ? 1 : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && step !== "processing" && !publishing) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="converter-title"
        className="glass-strong relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-900/[0.07] px-5 py-4 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="saffron">
                <Sparkles className="h-3 w-3" aria-hidden />
                Flagship engine
              </Badge>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                5-stage pipeline
              </span>
            </div>
            <h2
              id="converter-title"
              className="mt-2 font-display text-lg font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white sm:text-xl"
            >
              Turn any paper into a mock test
            </h2>
            <p className="mt-1 text-[11.5px] text-ink-500 dark:text-ink-400">
              {mode === "upload"
                ? "PDF, DOCX, Markdown, TXT or a photo of the paper. OCR runs server-side."
                : "Paste the paper as Markdown or plain text — no OCR needed."}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={step === "processing" || publishing}
            className="press grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-500 hover:bg-ink-900/[0.06] hover:text-ink-800 disabled:opacity-40 dark:text-ink-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close converter"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Stepper */}
        <ol className="flex items-center gap-2 border-b border-ink-900/[0.06] px-5 py-3 dark:border-white/[0.08] sm:px-6">
          {steps.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold",
                  index < stepIndex
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : index === stepIndex
                      ? "bg-brand-600 text-white"
                      : "bg-ink-900/[0.06] text-ink-500 dark:bg-white/10 dark:text-ink-400",
                )}
              >
                {index < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[11px] font-semibold sm:block",
                  index === stepIndex
                    ? "text-ink-900 dark:text-white"
                    : "text-ink-500 dark:text-ink-400",
                )}
              >
                {label}
              </span>
              {index < steps.length - 1 ? (
                <span className="h-px flex-1 bg-ink-900/[0.08] dark:bg-white/10" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {error ? (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-[12px] text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="min-w-0">{error}</p>
            </div>
          ) : null}

          {step === "details" ? (
            <div className="space-y-5">
              <div className="flex gap-1.5 rounded-xl bg-ink-900/[0.05] p-1 dark:bg-white/[0.06]">
                {[
                  { id: "upload" as const, label: "Upload a file", icon: UploadCloud },
                  { id: "paste" as const, label: "Paste text", icon: ClipboardPaste },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={cn(
                      "press flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold",
                      mode === id
                        ? "bg-white text-ink-900 shadow-sm dark:bg-white/12 dark:text-white"
                        : "text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-white",
                    )}
                    aria-pressed={mode === id}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>

              {mode === "upload" ? (
                <div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS}
                    className="sr-only"
                    onChange={(event) => acceptFile(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      acceptFile(event.dataTransfer.files?.[0]);
                    }}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors",
                      dragActive
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-ink-900/15 bg-white/40 hover:border-brand-500/50 hover:bg-brand-500/[0.06] dark:border-white/15 dark:bg-white/[0.03]",
                    )}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-saffron-400/15 text-saffron-600 ring-1 ring-inset ring-saffron-500/20 dark:text-saffron-300">
                      <UploadCloud className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-[13px] font-bold text-ink-900 dark:text-white">
                      {dragActive ? "Drop the paper here" : "Drop a paper or click to browse"}
                    </span>
                    <span className="text-[10.5px] text-ink-500 dark:text-ink-400">
                      PDF · DOCX · MD · TXT · PNG/JPG — max 25 MB
                    </span>
                  </button>

                  {file ? (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-ink-900/[0.08] bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.05]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/12 text-brand-700 dark:text-brand-300">
                        <FileText className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-ink-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-[10.5px] text-ink-500 dark:text-ink-400">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB · {extensionOf(file.name).toUpperCase()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="press grid h-7 w-7 place-items-center rounded-lg text-ink-500 hover:bg-ink-900/[0.06] hover:text-rose-600 dark:text-ink-400 dark:hover:bg-white/10"
                        aria-label="Remove file"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="paper-paste"
                      className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400"
                    >
                      Paper text
                    </label>
                    <button
                      type="button"
                      onClick={() => setPasteText(SAMPLE_PAPER)}
                      className="press inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300"
                    >
                      <Wand2 className="h-3.5 w-3.5" aria-hidden />
                      Use sample paper
                    </button>
                  </div>
                  <textarea
                    id="paper-paste"
                    value={pasteText}
                    onChange={(event) => setPasteText(event.target.value)}
                    rows={10}
                    placeholder={"# Exam: ssc-cgl\n# Year: 2024\n# Marks: +2.0, -0.50\n\nQ1. Question text…\n(A) …\n(B) …\n(C) …\n(D) …\nAns: B"}
                    className="w-full resize-y rounded-2xl border border-ink-900/12 bg-white/70 px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-ink-500"
                  />
                  <p className="mt-1.5 text-[10.5px] text-ink-500 dark:text-ink-400">
                    {pasteText.trim() ? `${pasteText.trim().split(/\s+/).length} words` : "Markdown contributor format works best."}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="rounded-2xl border border-ink-900/[0.07] bg-white/40 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="mb-3 flex items-center gap-2">
                  <ScanText className="h-4 w-4 text-brand-600 dark:text-brand-300" aria-hidden />
                  <p className="text-[12px] font-bold text-ink-900 dark:text-white">
                    Paper details
                  </p>
                  <span className="ml-auto text-[10px] font-medium text-ink-500 dark:text-ink-400">
                    Prefilled from {selectedExam.shortName}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                      Exam / paper
                    </span>
                    <select
                      value={examSlug}
                      onChange={(event) => applyExamDefaults(event.target.value)}
                      className="w-full rounded-xl border border-ink-900/12 bg-white/80 px-3 py-2 text-[12.5px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                    >
                      {examOptions.map((exam) => (
                        <option key={exam.slug} value={exam.slug}>
                          {exam.shortName} — {exam.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                      Year
                    </span>
                    <input
                      type="number"
                      min={1990}
                      max={CURRENT_YEAR + 1}
                      value={year}
                      onChange={(event) => handleYearChange(Number.parseInt(event.target.value, 10) || CURRENT_YEAR - 1)}
                      className="w-full rounded-xl border border-ink-900/12 bg-white/80 px-3 py-2 text-[12.5px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                      Paper title
                    </span>
                    <input
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="w-full rounded-xl border border-ink-900/12 bg-white/80 px-3 py-2 text-[12.5px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                      Shift / tier
                    </span>
                    <input
                      type="text"
                      value={shift}
                      onChange={(event) => handleShiftChange(event.target.value)}
                      placeholder="Tier-I Shift 1"
                      className="w-full rounded-xl border border-ink-900/12 bg-white/80 px-3 py-2 text-[12.5px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                      Duration (minutes)
                    </span>
                    <input
                      type="number"
                      min={5}
                      max={360}
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(Number.parseInt(event.target.value, 10) || 60)}
                      className="w-full rounded-xl border border-ink-900/12 bg-white/80 px-3 py-2 text-[12.5px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                      Marks per correct
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      max={10}
                      value={positiveMarks}
                      onChange={(event) => setPositiveMarks(Number.parseFloat(event.target.value) || 0)}
                      className="w-full rounded-xl border border-ink-900/12 bg-white/80 px-3 py-2 text-[12.5px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                      Negative per wrong
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={10}
                      value={negativeMarks}
                      onChange={(event) => setNegativeMarks(Number.parseFloat(event.target.value) || 0)}
                      className="w-full rounded-xl border border-ink-900/12 bg-white/80 px-3 py-2 text-[12.5px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                    />
                  </label>
                </div>

                <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-500 dark:text-ink-400">
                  <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  Defaults follow {selectedExam.shortName} marking ({positiveMarks > 0 ? `+${positiveMarks}` : "no positive"} /
                  {negativeMarks > 0 ? ` −${negativeMarks}` : " no negative"}). Header values inside the file override these.
                </p>
                {examSlug === "gate-cse" ? (
                  <p className="mt-2 rounded-xl border border-saffron-500/20 bg-saffron-400/10 px-3 py-2 text-[10.5px] leading-relaxed text-ink-700 dark:text-ink-200">
                    GATE papers mix 1- and 2-mark questions. MCQ has negative marking; MSQ and NAT do not. The review below lets you confirm each question type and marks before publishing.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "processing" ? (
            <div className="flex flex-col items-center justify-center gap-5 py-10 text-center sm:py-14">
              <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/12 text-brand-700 dark:text-brand-300">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
              </span>
              <div>
                <p className="font-display text-base font-bold text-ink-900 dark:text-white">
                  Converting your paper
                </p>
                <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
                  Reading text, OCR for scanned pages, then splitting questions and answer keys.
                  Progress updates live.
                </p>
              </div>
              <div className="w-full max-w-md text-left">
                <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-ink-600 dark:text-ink-300">
                  <span className="min-w-0 truncate" aria-live="polite">
                    {stageLabel}
                  </span>
                  <span className="shrink-0 font-mono text-ink-500 dark:text-ink-400">
                    {Math.round(progress)}%
                  </span>
                </div>
                <ProgressBar value={progress} tone="saffron" />
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PIPELINE_STEPS.map((item, index) => {
                    const done = index < activeStageIndex;
                    const active = index === activeStageIndex;
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          "rounded-xl border px-2.5 py-2 text-[10.5px] font-semibold",
                          done
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : active
                              ? "border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                              : "border-ink-900/[0.07] bg-white/40 text-ink-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-ink-400",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          {done ? (
                            <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                          ) : active ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                          ) : (
                            <span className="grid h-3 w-3 shrink-0 place-items-center rounded-full bg-ink-900/10 font-mono text-[8px] dark:bg-white/10">
                              {index + 1}
                            </span>
                          )}
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-[10.5px] leading-snug text-ink-500 dark:text-ink-400">
                  Keep this dialog open. The server keeps working even if the page is slow.
                </p>
              </div>
            </div>
          ) : null}

          {step === "review" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-ink-900/[0.07] bg-white/45 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    {questions.length} questions extracted
                  </Badge>
                  <Badge tone={flaggedCount ? "saffron" : "success"}>
                    {flaggedCount ? `${flaggedCount} flagged for review` : "No flags"}
                  </Badge>
                  <Badge tone="brand">
                    {Math.round((job?.averageConfidence ?? 0) * 100)}% avg confidence
                  </Badge>
                  {typeof job?.parsedDraftJson?.maximumMarks === "number" ? (
                    <Badge tone="saffron">
                      Maximum marks · {job.parsedDraftJson.maximumMarks}
                    </Badge>
                  ) : null}
                  {typeof job?.parsedDraftJson?.expectedQuestionCount === "number" ? (
                    <Badge tone={job.parsedDraftJson.expectedQuestionCount === questions.length ? "success" : "saffron"}>
                      {job.parsedDraftJson.expectedQuestionCount} expected questions
                    </Badge>
                  ) : null}
                  {job?.parsedDraftJson?.extractionMethod ? (
                    <Badge>
                      <ScanText className="h-3 w-3" aria-hidden />
                      {job.parsedDraftJson.extractionMethod}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                      Title
                    </span>
                    <input
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="w-full rounded-lg border border-ink-900/12 bg-white/80 px-2.5 py-1.5 text-[12px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                    />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                        + Marks
                      </span>
                      <input
                        type="number"
                        step="0.25"
                        value={positiveMarks}
                        onChange={(event) => setPositiveMarks(Number.parseFloat(event.target.value) || 0)}
                        className="w-full rounded-lg border border-ink-900/12 bg-white/80 px-2 py-1.5 text-[12px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                        − Marks
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={negativeMarks}
                        onChange={(event) => setNegativeMarks(Number.parseFloat(event.target.value) || 0)}
                        className="w-full rounded-lg border border-ink-900/12 bg-white/80 px-2 py-1.5 text-[12px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                        Minutes
                      </span>
                      <input
                        type="number"
                        value={durationMinutes}
                        onChange={(event) => setDurationMinutes(Number.parseInt(event.target.value, 10) || 60)}
                        className="w-full rounded-lg border border-ink-900/12 bg-white/80 px-2 py-1.5 text-[12px] font-medium text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                    <span>Answer key coverage</span>
                    <span className="font-mono">
                      {answeredCount}/{questions.length}
                    </span>
                  </div>
                  <ProgressBar
                    value={(answeredCount / Math.max(questions.length, 1)) * 100}
                    tone={answeredCount === questions.length ? "emerald" : "saffron"}
                  />
                </div>
              </div>

              {job?.parsedDraftJson?.warnings?.length ? (
                <ul className="space-y-1.5 rounded-2xl border border-saffron-500/25 bg-saffron-400/10 px-3.5 py-3 text-[11.5px] leading-snug text-saffron-800 dark:text-saffron-200">
                  {job.parsedDraftJson.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-ink-500 dark:text-ink-400">
                  Tap an option to set the answer key. Low-confidence questions are flagged.
                </p>
                <button
                  type="button"
                  onClick={() => setFlaggedOnly((current) => !current)}
                  className={cn(
                    "press shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ring-1 ring-inset",
                    flaggedOnly
                      ? "bg-saffron-400/15 text-saffron-800 ring-saffron-500/25 dark:text-saffron-200"
                      : "text-ink-600 ring-ink-900/10 hover:bg-white/60 dark:text-ink-300 dark:ring-white/10 dark:hover:bg-white/10",
                  )}
                  aria-pressed={flaggedOnly}
                >
                  Flagged only ({flaggedCount})
                </button>
              </div>

              <ol className="space-y-2.5">
                {visibleQuestions.map((question) => {
                  const tone = confidenceTone(question.sourceConfidence);
                  const isEditing = editingQuestion === question.questionNumber;
                  const questionType = questionTypeOf(question);
                  const isNumerical = questionType === "NUMERICAL";
                  const isMulti = questionType === "MULTI_CHOICE";

                  return (
                    <li
                      key={question.questionNumber}
                      className="rounded-2xl border border-ink-900/[0.07] bg-white/50 p-3.5 dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid h-6 min-w-6 place-items-center rounded-lg bg-ink-900/[0.06] px-1.5 font-mono text-[10.5px] font-bold text-ink-700 dark:bg-white/10 dark:text-ink-200">
                          Q{question.questionNumber}
                        </span>
                        <select
                          value={questionType}
                          onChange={(event) => {
                            const nextType = event.target.value as
                              | "SINGLE_CHOICE"
                              | "MULTI_CHOICE"
                              | "NUMERICAL";
                            updateQuestion(question.questionNumber, {
                              questionType: nextType,
                              correctOptionId:
                                nextType === "NUMERICAL" ? null : question.correctOptionId,
                              correctOptionIds:
                                nextType === "NUMERICAL"
                                  ? []
                                  : question.correctOptionIds?.length
                                    ? question.correctOptionIds
                                    : question.correctOptionId
                                      ? [question.correctOptionId]
                                      : [],
                            });
                          }}
                          className="rounded-lg border border-ink-900/10 bg-white/70 px-1.5 py-1 font-mono text-[10px] font-bold text-ink-700 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-[#111827] dark:text-ink-200"
                          aria-label={`Question ${question.questionNumber} type`}
                        >
                          <option value="SINGLE_CHOICE">MCQ</option>
                          <option value="MULTI_CHOICE">MSQ</option>
                          <option value="NUMERICAL">NAT</option>
                        </select>
                        <label className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-ink-500 dark:text-ink-400">
                          +
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={question.marks ?? positiveMarks}
                            onChange={(event) => updateQuestion(question.questionNumber, { marks: Number(event.target.value) || 0 })}
                            className="h-6 w-12 rounded-md border border-ink-900/10 bg-white/75 px-1 font-mono text-[10px] text-ink-800 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-[#111827] dark:text-ink-100"
                            aria-label={`Question ${question.questionNumber} marks`}
                          />
                        </label>
                        <label className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-ink-500 dark:text-ink-400">
                          −
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={question.negativeMarks ?? negativeMarks}
                            onChange={(event) => updateQuestion(question.questionNumber, { negativeMarks: Number(event.target.value) || 0 })}
                            className="h-6 w-12 rounded-md border border-ink-900/10 bg-white/75 px-1 font-mono text-[10px] text-ink-800 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-[#111827] dark:text-ink-100"
                            aria-label={`Question ${question.questionNumber} negative marks`}
                          />
                        </label>
                        <Badge tone={tone.tone}>{tone.label}</Badge>
                        {question.subjectTag ? <Badge>{question.subjectTag}</Badge> : null}
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingQuestion(isEditing ? null : question.questionNumber)
                            }
                            className="press rounded-lg px-2 py-1 text-[10.5px] font-semibold text-brand-700 hover:bg-brand-500/10 dark:text-brand-300"
                          >
                            {isEditing ? "Done" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeQuestion(question.questionNumber)}
                            className="press grid h-6 w-6 place-items-center rounded-lg text-ink-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-ink-400"
                            aria-label={`Remove question ${question.questionNumber}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={question.text}
                          onChange={(event) =>
                            updateQuestion(question.questionNumber, { text: event.target.value })
                          }
                          rows={3}
                          className="mt-2 w-full resize-y rounded-xl border border-ink-900/12 bg-white/80 px-3 py-2 text-[12px] leading-relaxed text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                        />
                      ) : (
                        <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-ink-900 dark:text-ink-100">
                          {question.text}
                        </p>
                      )}

                      {isNumerical ? (
                        <div className="mt-2.5 flex flex-wrap items-end gap-2">
                          <label className="text-[10.5px] font-semibold text-ink-500 dark:text-ink-400">
                            Numerical answer
                            <input
                              type="number"
                              step="any"
                              value={question.correctNumericalAnswer ?? ""}
                              onChange={(event) =>
                                updateQuestion(question.questionNumber, {
                                  questionType: "NUMERICAL",
                                  correctNumericalAnswer:
                                    event.target.value === "" ? null : Number(event.target.value),
                                  correctOptionId: null,
                                  correctOptionIds: [],
                                  needsHumanReview: false,
                                })
                              }
                              className="mt-1 block h-8 w-32 rounded-lg border border-ink-900/12 bg-white/80 px-2 font-mono text-[11px] text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                            />
                          </label>
                          <label className="text-[10.5px] font-semibold text-ink-500 dark:text-ink-400">
                            Tolerance
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={question.numericalTolerance ?? 0.01}
                              onChange={(event) =>
                                updateQuestion(question.questionNumber, {
                                  numericalTolerance:
                                    event.target.value === "" ? 0.01 : Number(event.target.value),
                                })
                              }
                              className="mt-1 block h-8 w-24 rounded-lg border border-ink-900/12 bg-white/80 px-2 font-mono text-[11px] text-ink-900 focus:border-brand-500 focus:outline-none dark:border-white/12 dark:bg-[#111827] dark:text-white"
                            />
                          </label>
                          <p className="pb-1 text-[10px] text-ink-500 dark:text-ink-400">
                            NAT answers are graded within this tolerance.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                          {isMulti ? (
                            <p className="sm:col-span-2 text-[10.5px] text-ink-500 dark:text-ink-400">
                              MSQ: select every correct option. No partial marking.
                            </p>
                          ) : null}
                          {question.options.map((option) => {
                            const selectedIds = question.correctOptionIds?.length
                              ? question.correctOptionIds
                              : question.correctOptionId
                                ? [question.correctOptionId]
                                : [];
                            const selected = isMulti
                              ? selectedIds.includes(option.id)
                              : option.id === question.correctOptionId;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  if (isMulti) {
                                    const nextIds = selected
                                      ? selectedIds.filter((id) => id !== option.id)
                                      : [...selectedIds, option.id];
                                    updateQuestion(question.questionNumber, {
                                      questionType: "MULTI_CHOICE",
                                      correctOptionIds: nextIds,
                                      correctOptionId: nextIds[0] ?? null,
                                      needsHumanReview: false,
                                    });
                                    return;
                                  }
                                  updateQuestion(question.questionNumber, {
                                    questionType: "SINGLE_CHOICE",
                                    correctOptionId: option.id,
                                    correctOptionIds: [option.id],
                                    needsHumanReview: false,
                                  });
                                }}
                                className={cn(
                                  "press flex items-start gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[11.5px] leading-snug",
                                  selected
                                    ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-200"
                                    : "border-ink-900/[0.08] bg-white/50 text-ink-700 hover:border-brand-500/40 hover:bg-brand-500/[0.06] dark:border-white/10 dark:bg-white/[0.03] dark:text-ink-200",
                                )}
                                aria-pressed={selected}
                              >
                                <span
                                  className={cn(
                                    "mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full font-mono text-[9px] font-bold",
                                    selected
                                      ? "bg-emerald-600 text-white"
                                      : "bg-ink-900/[0.07] text-ink-600 dark:bg-white/10 dark:text-ink-300",
                                  )}
                                >
                                  {option.id}
                                </span>
                                <span className="min-w-0">{option.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {question.explanation ? (
                        <p className="mt-2 rounded-lg bg-ink-900/[0.03] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-ink-500 dark:bg-white/[0.04] dark:text-ink-400">
                          <span className="font-semibold text-ink-700 dark:text-ink-200">Explanation:</span>{" "}
                          {question.explanation}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              {visibleQuestions.length === 0 ? (
                <p className="rounded-2xl border border-ink-900/[0.07] bg-white/40 px-4 py-6 text-center text-[12px] text-ink-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-ink-400">
                  No questions match this filter.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === "done" && published ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-300">
                <CheckCircle2 className="h-7 w-7" aria-hidden />
              </span>
              <div>
                <p className="font-display text-lg font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">
                  Paper published
                </p>
                <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                  <span className="font-semibold text-ink-900 dark:text-white">{published.title}</span> is live
                  with {published.questionCount} reviewed questions. It now appears in the papers list and can be
                  attempted with the real timer.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a href="#papers" onClick={onClose} className={cn(primaryButton, "px-4 py-2 text-[12.5px]")}>
                  View papers
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </a>
                <button
                  type="button"
                  onClick={resetForAnother}
                  className={cn(secondaryButton, "px-4 py-2 text-[12.5px]")}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Convert another
                </button>
              </div>
              <p className="font-mono text-[10px] text-ink-500 dark:text-ink-400">
                paper slug: {published.slug}
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {step !== "processing" && step !== "done" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/[0.07] px-5 py-3.5 dark:border-white/10 sm:px-6">
            <p className="text-[10.5px] text-ink-500 dark:text-ink-400">
              {step === "details"
                ? "Human review happens before anything goes live."
                : `${questions.length} questions · ${answeredCount} answer keys set`}
            </p>
            <div className="flex items-center gap-2">
              {step === "review" ? (
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className={cn(secondaryButton, "px-3.5 py-2 text-[12.5px]")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Back
                </button>
              ) : null}
              {step === "details" ? (
                <button
                  type="button"
                  onClick={submit}
                  className={cn(primaryButton, "px-4 py-2 text-[12.5px]")}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Run the converter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={publish}
                  disabled={publishing || questions.length === 0}
                  className={cn(primaryButton, "px-4 py-2 text-[12.5px] disabled:opacity-50")}
                >
                  {publishing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {publishing ? "Publishing…" : "Publish paper"}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
