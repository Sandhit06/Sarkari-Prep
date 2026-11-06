'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  Languages,
  ListChecks,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge, GlassCard, ProgressBar, primaryButton, secondaryButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  autosaveResponseApi,
  fetchPaperApi,
  getAttemptApi,
  startAttemptApi,
  submitAttemptApi,
  type Attempt,
  type PaperQuestion,
  type PlayablePaper,
  type ResponseInput,
} from '@/lib/api';
import {
  clearResumeState,
  ensureGuestUserId,
  getResumeState,
  saveResumeState,
} from '@/lib/session';

type LocalResponse = {
  selectedOptionId: string | null;
  selectedOptionIds: string[];
  selectedNumericalAnswer: string;
  status: string;
  timeSpentSecs: number;
  flaggedForReview: boolean;
  changedAnswerCount: number;
  visited: boolean;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const paletteStyles: Record<string, string> = {
  NOT_VISITED:
    'border-ink-900/10 bg-white/55 text-ink-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-ink-300',
  NOT_ANSWERED:
    'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300',
  ANSWERED:
    'border-emerald-600/40 bg-emerald-600 text-white shadow-[0_4px_10px_-6px_rgba(5,150,105,0.9)]',
  MARKED_FOR_REVIEW:
    'border-violet-600/40 bg-violet-600 text-white shadow-[0_4px_10px_-6px_rgba(124,58,237,0.9)]',
  ANSWERED_AND_MARKED:
    'border-violet-600/40 bg-violet-600 text-white shadow-[0_4px_10px_-6px_rgba(124,58,237,0.9)]',
};

function makeResponse(visited = false): LocalResponse {
  return {
    selectedOptionId: null,
    selectedOptionIds: [],
    selectedNumericalAnswer: '',
    status: 'NOT_ANSWERED',
    timeSpentSecs: 0,
    flaggedForReview: false,
    changedAnswerCount: 0,
    visited,
  };
}

function isResponseAnswered(response: LocalResponse | undefined): boolean {
  if (!response) return false;
  return (
    response.selectedOptionId !== null ||
    response.selectedOptionIds.length > 0 ||
    response.selectedNumericalAnswer.trim() !== ''
  );
}

function numericValue(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPayload(response: LocalResponse): Omit<ResponseInput, 'questionId'> {
  return {
    selectedOptionId: response.selectedOptionId,
    selectedOptionIds: response.selectedOptionIds,
    selectedNumericalAnswer: numericValue(response.selectedNumericalAnswer),
    status: response.status,
    timeSpentSecs: response.timeSpentSecs,
    flaggedForReview: response.flaggedForReview,
    changedAnswerCount: response.changedAnswerCount,
  };
}

function isAttemptResponseAnswered(response: { selectedOptionId: string | null; selectedOptionIds?: string[]; selectedNumericalAnswer?: number | null } | undefined): boolean {
  if (!response) return false;
  return (
    response.selectedOptionId !== null ||
    (response.selectedOptionIds?.length ?? 0) > 0 ||
    response.selectedNumericalAnswer != null
  );
}

function formatTime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mins}:${secs}` : `${mins}:${secs}`;
}

function questionText(question: PaperQuestion, language: 'en' | 'hi') {
  if (language === 'hi' && question.textHindi) return question.textHindi;
  return question.text;
}

function optionText(option: { text: string; textHindi?: string | null }, language: 'en' | 'hi') {
  if (language === 'hi' && option.textHindi) return option.textHindi;
  return option.text;
}

export function TestPlayer({ paperIdOrSlug }: { paperIdOrSlug: string }) {
  const [paper, setPaper] = useState<PlayablePaper | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [responses, setResponses] = useState<Record<string, LocalResponse>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Attempt | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const autoSubmitRef = useRef(false);

  const totalQuestions = useMemo(
    () => paper?.sections.reduce((sum, section) => sum + section.questions.length, 0) ?? 0,
    [paper],
  );

  const currentSection = paper?.sections[currentSectionIndex] ?? null;
  const currentQuestion = currentSection?.questions[currentQuestionIndex] ?? null;
  const currentQuestionId = currentQuestion?.id;

  const answeredCount = useMemo(
    () => Object.values(responses).filter(isResponseAnswered).length,
    [responses],
  );
  const visitedCount = useMemo(
    () => Object.values(responses).filter((response) => response.visited).length,
    [responses],
  );
  const reviewCount = useMemo(
    () => Object.values(responses).filter((response) => response.flaggedForReview).length,
    [responses],
  );

  const persistResponse = useCallback(
    (questionId: string, response: LocalResponse) => {
      if (!attempt) return;
      setSaveState('saving');
      autosaveResponseApi(attempt.id, { questionId, ...toPayload(response) })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [attempt],
  );

  const selectOption = useCallback(
    (question: PaperQuestion, optionId: string) => {
      const current = responses[question.id] ?? makeResponse(true);
      const isMulti = question.type === 'MULTI_CHOICE';
      const currentIds = current.selectedOptionIds;
      const nextIds = isMulti
        ? currentIds.includes(optionId)
          ? currentIds.filter((id) => id !== optionId)
          : [...currentIds, optionId]
        : [optionId];
      const changed = isMulti
        ? currentIds.join(',') !== nextIds.join(',')
        : current.selectedOptionId !== optionId;
      const hasAnswer = nextIds.length > 0;
      const next: LocalResponse = {
        ...current,
        selectedOptionId: isMulti ? null : optionId,
        selectedOptionIds: nextIds,
        selectedNumericalAnswer: '',
        status: hasAnswer
          ? current.flaggedForReview
            ? 'ANSWERED_AND_MARKED'
            : 'ANSWERED'
          : current.flaggedForReview
            ? 'MARKED_FOR_REVIEW'
            : 'NOT_ANSWERED',
        changedAnswerCount: changed ? current.changedAnswerCount + 1 : current.changedAnswerCount,
        visited: true,
      };
      setResponses((previous) => ({ ...previous, [question.id]: next }));
      persistResponse(question.id, next);
    },
    [persistResponse, responses],
  );

  const setNumericalAnswer = useCallback(
    (questionId: string, value: string) => {
      const current = responses[questionId] ?? makeResponse(true);
      const hasAnswer = value.trim() !== '';
      const next: LocalResponse = {
        ...current,
        selectedOptionId: null,
        selectedOptionIds: [],
        selectedNumericalAnswer: value,
        status: hasAnswer
          ? current.flaggedForReview
            ? 'ANSWERED_AND_MARKED'
            : 'ANSWERED'
          : current.flaggedForReview
            ? 'MARKED_FOR_REVIEW'
            : 'NOT_ANSWERED',
        visited: true,
      };
      setResponses((previous) => ({ ...previous, [questionId]: next }));
      persistResponse(questionId, next);
    },
    [persistResponse, responses],
  );

  const toggleReview = useCallback(() => {
    if (!currentQuestion) return;
    const current = responses[currentQuestion.id] ?? makeResponse(true);
    const flagged = !current.flaggedForReview;
    const next: LocalResponse = {
      ...current,
      flaggedForReview: flagged,
      status: isResponseAnswered(current)
        ? flagged
          ? 'ANSWERED_AND_MARKED'
          : 'ANSWERED'
        : flagged
          ? 'MARKED_FOR_REVIEW'
          : 'NOT_ANSWERED',
      visited: true,
    };
    setResponses((previous) => ({ ...previous, [currentQuestion.id]: next }));
    persistResponse(currentQuestion.id, next);
  }, [currentQuestion, persistResponse, responses]);

  const clearResponse = useCallback(() => {
    if (!currentQuestion) return;
    const current = responses[currentQuestion.id] ?? makeResponse(true);
    const next: LocalResponse = {
      ...current,
      selectedOptionId: null,
      selectedOptionIds: [],
      selectedNumericalAnswer: '',
      status: 'NOT_ANSWERED',
      flaggedForReview: false,
      visited: true,
    };
    setResponses((previous) => ({ ...previous, [currentQuestion.id]: next }));
    persistResponse(currentQuestion.id, next);
  }, [currentQuestion, persistResponse, responses]);

  const navigateTo = useCallback(
    (sectionIndex: number, questionIndex: number) => {
      const section = paper?.sections[sectionIndex];
      if (!section) return;
      const safeIndex = Math.min(Math.max(0, questionIndex), Math.max(0, section.questions.length - 1));
      setCurrentSectionIndex(sectionIndex);
      setCurrentQuestionIndex(safeIndex);
    },
    [paper],
  );

  const goPrevious = useCallback(() => {
    if (!paper || !currentSection) return;
    if (currentQuestionIndex > 0) {
      navigateTo(currentSectionIndex, currentQuestionIndex - 1);
    } else if (currentSectionIndex > 0) {
      const previousSectionIndex = currentSectionIndex - 1;
      const previousSection = paper.sections[previousSectionIndex];
      navigateTo(previousSectionIndex, Math.max(0, previousSection.questions.length - 1));
    }
  }, [currentQuestionIndex, currentSection, currentSectionIndex, navigateTo, paper]);

  const goNext = useCallback(() => {
    if (!paper || !currentSection) return;
    if (currentQuestionIndex < currentSection.questions.length - 1) {
      navigateTo(currentSectionIndex, currentQuestionIndex + 1);
    } else if (currentSectionIndex < paper.sections.length - 1) {
      navigateTo(currentSectionIndex + 1, 0);
    }
  }, [currentQuestionIndex, currentSection, currentSectionIndex, navigateTo, paper]);

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (!paper || !attempt || submitting || result) return;
      if (!auto && !window.confirm('Submit this test now? You will not be able to change your answers.')) {
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        const payload: ResponseInput[] = paper.sections.flatMap((section) =>
          section.questions.map((question) => {
            const response = responses[question.id] ?? makeResponse(false);
            return { questionId: question.id, ...toPayload(response) };
          }),
        );
        const completed = await submitAttemptApi(attempt.id, payload);
        setResult(completed);
        clearResumeState();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not submit the test. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [attempt, paper, responses, result, submitting],
  );

  useEffect(() => {
    if (loadPromiseRef.current) return;

    loadPromiseRef.current = (async () => {
      setLoading(true);
      setError(null);
      try {
        const loadedPaper = await fetchPaperApi(paperIdOrSlug);
        const total = loadedPaper.sections.reduce(
          (sum, section) => sum + section.questions.length,
          0,
        );
        if (total === 0) {
          throw new Error('This paper has no questions yet. Try another mock test.');
        }

        const userId = await ensureGuestUserId();
        const resume = getResumeState();
        let loadedAttempt: Attempt | null = null;

        if (resume) {
          try {
            const maybe = await getAttemptApi(resume.attemptId);
            if (maybe.paper?.slug === loadedPaper.slug) {
              if (maybe.isCompleted) {
                setPaper(maybe.paper ?? loadedPaper);
                setAttempt(maybe);
                setResult(maybe);
                setLoading(false);
                return;
              }
              loadedAttempt = maybe;
            }
          } catch {
            // Stale resume pointer; start or resume normally below.
          }
        }

        if (!loadedAttempt) {
          const started = await startAttemptApi(userId, loadedPaper.id);
          // `start` may resume an existing attempt; fetch the full payload so
          // any previously autosaved responses are restored in the player.
          loadedAttempt = await getAttemptApi(started.id);
        }

        const attemptPaper = loadedAttempt.paper ?? loadedPaper;
        const responseMap: Record<string, LocalResponse> = {};
        for (const response of loadedAttempt.responses ?? []) {
          responseMap[response.questionId] = {
            selectedOptionId: response.selectedOptionId,
            selectedOptionIds: response.selectedOptionIds ?? [],
            selectedNumericalAnswer:
              response.selectedNumericalAnswer != null
                ? String(response.selectedNumericalAnswer)
                : '',
            status: response.status,
            timeSpentSecs: response.timeSpentSecs,
            flaggedForReview: response.flaggedForReview,
            changedAnswerCount: response.changedAnswerCount,
            visited: true,
          };
        }

        const firstQuestion = attemptPaper.sections[0]?.questions[0];
        if (firstQuestion && !responseMap[firstQuestion.id]) {
          responseMap[firstQuestion.id] = makeResponse(true);
        }

        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - new Date(loadedAttempt.startedAt).getTime()) / 1000),
        );

        setPaper(attemptPaper);
        setAttempt(loadedAttempt);
        setResponses(responseMap);
        setCurrentSectionIndex(0);
        setCurrentQuestionIndex(0);
        setSecondsLeft(Math.max(0, attemptPaper.durationMinutes * 60 - elapsed));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not open this test.');
      } finally {
        setLoading(false);
      }
    })();
  }, [paperIdOrSlug]);

  useEffect(() => {
    if (!paper || result) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [paper, result]);

  useEffect(() => {
    if (!paper || !currentQuestionId || result) return;
    const interval = window.setInterval(() => {
      setResponses((previous) => {
        const current = previous[currentQuestionId] ?? makeResponse(true);
        return {
          ...previous,
          [currentQuestionId]: {
            ...current,
            timeSpentSecs: current.timeSpentSecs + 1,
            visited: true,
          },
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [paper, currentQuestionId, result]);

  useEffect(() => {
    if (!currentQuestionId) return;
    setResponses((previous) => {
      const current = previous[currentQuestionId];
      if (current?.visited) return previous;
      return {
        ...previous,
        [currentQuestionId]: { ...(current ?? makeResponse()), visited: true },
      };
    });
  }, [currentQuestionId]);

  useEffect(() => {
    if (!paper || !attempt || result) return;
    saveResumeState({
      attemptId: attempt.id,
      paperSlug: paper.slug,
      paperTitle: paper.title,
      answered: answeredCount,
      total: totalQuestions,
      secondsLeft,
      updatedAt: new Date().toISOString(),
    });
  }, [answeredCount, attempt, paper, result, secondsLeft, totalQuestions]);

  useEffect(() => {
    if (!paper || !attempt || result || submitting) return;
    if (secondsLeft > 0 || autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    void handleSubmit(true);
  }, [attempt, handleSubmit, paper, result, secondsLeft, submitting]);

  if (loading) {
    return (
      <ScreenState
        title="Preparing your test"
        description="Loading the paper and restoring your saved answers."
      />
    );
  }

  if (error && !paper) {
    return (
      <ScreenState
        title="Could not open this test"
        description={error}
        isError
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (result) {
    return <ResultScreen result={result} paper={paper} />;
  }

  if (!paper || !currentSection || !currentQuestion) {
    return (
      <ScreenState
        title="This paper is not ready"
        description="The paper has no playable questions yet. Please pick another mock test."
        isError
      />
    );
  }

  const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
  const currentResponse = responses[currentQuestion.id] ?? makeResponse(true);
  const questionType = currentQuestion.type ?? 'SINGLE_CHOICE';
  const isNumerical = questionType === 'NUMERICAL';
  const isMulti = questionType === 'MULTI_CHOICE';
  const isFlagged = currentResponse.flaggedForReview;
  const lowTime = secondsLeft <= 300;

  return (
    <div className="min-h-dvh pb-6">
      <header className="sticky top-0 z-40 border-b border-ink-900/[0.07] bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#070a12]/85">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:px-5">
          <Link
            href="/"
            className="press glass-soft grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-700 dark:text-ink-200"
            aria-label="Leave the test and return home"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-ink-900 dark:text-white">{paper.title}</p>
            <p className="truncate text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
              {paper.exam?.shortName ? `${paper.exam.shortName} · ` : ''}
              {totalQuestions} questions · {paper.durationMinutes} min
            </p>
          </div>

          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-mono text-[12px] font-bold',
              lowTime
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                : 'border-ink-900/10 bg-white/60 text-ink-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-ink-100',
            )}
            aria-live="polite"
          >
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {formatTime(secondsLeft)}
          </span>

          <button
            type="button"
            onClick={() => void handleSubmit(false)}
            disabled={submitting}
            className={cn(primaryButton, 'shrink-0 px-3 py-2 text-[12.5px] disabled:opacity-60')}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">Submit</span>
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-3">
          {error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-[12px] text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {paper.sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => navigateTo(index, 0)}
                className={cn(
                  'press rounded-full px-3 py-1.5 text-[11.5px] font-semibold ring-1 ring-inset',
                  index === currentSectionIndex
                    ? 'bg-ink-900 text-white ring-ink-900 dark:bg-white dark:text-ink-900 dark:ring-white'
                    : 'bg-white/45 text-ink-600 ring-ink-900/[0.07] hover:bg-white/80 dark:bg-white/[0.04] dark:text-ink-300 dark:ring-white/10',
                )}
              >
                {section.name}
                <span className="ml-1.5 font-mono text-[10px] opacity-70">{section.questions.length}</span>
              </button>
            ))}
          </div>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                  {currentSection.name}
                </p>
                <p className="mt-1 text-sm font-bold text-ink-900 dark:text-white">
                  Question {currentQuestionIndex + 1} of {currentSection.questions.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="brand">{isNumerical ? 'NAT' : isMulti ? 'MSQ' : 'MCQ'}</Badge>
                <Badge tone="neutral">
                  +{currentQuestion.marks} / �^'{currentQuestion.negativeMarks}
                </Badge>
                <button
                  type="button"
                  onClick={() => setLanguage((value) => (value === 'en' ? 'hi' : 'en'))}
                  className="press inline-flex items-center gap-1 rounded-lg border border-ink-900/10 bg-white/60 px-2 py-1 text-[11px] font-semibold text-ink-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-ink-300"
                  aria-label="Toggle question language"
                >
                  <Languages className="h-3 w-3" aria-hidden />
                  {language === 'en' ? 'EN / हिं' : 'हिं / EN'}
                </button>
              </div>
            </div>

            <p className="mt-4 text-[15px] font-medium leading-relaxed text-ink-900 text-pretty dark:text-ink-100">
              {questionText(currentQuestion, language)}
            </p>

            {isNumerical ? (
              <div className="mt-4 rounded-xl border border-ink-900/[0.07] bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                <label className="text-[11px] font-semibold text-ink-500 dark:text-ink-400">
                  Numerical answer
                </label>
                <input
                  type="number"
                  step="any"
                  value={currentResponse.selectedNumericalAnswer}
                  onChange={(event) => setNumericalAnswer(currentQuestion.id, event.target.value)}
                  placeholder="Enter your answer"
                  className="mt-1.5 block h-10 w-full max-w-xs rounded-xl border border-ink-900/12 bg-white px-3 font-mono text-[14px] text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 dark:border-white/12 dark:bg-[#111827] dark:text-white"
                />
                <p className="mt-1.5 text-[10.5px] text-ink-500 dark:text-ink-400">
                  Answers within +/-{currentQuestion.numericalTolerance ?? 0.01} are accepted. No negative marking for NAT.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                {isMulti ? (
                  <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                    Select all correct options. MSQ has no partial marking and no negative marking.
                  </p>
                ) : null}
                {options.map((option) => {
                  const isSelected = isMulti
                    ? currentResponse.selectedOptionIds.includes(option.id)
                    : currentResponse.selectedOptionId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectOption(currentQuestion, option.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        'press group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium',
                        isSelected
                          ? 'border-brand-500/60 bg-brand-500/10 text-ink-900 shadow-[0_0_0_3px_rgba(53,102,245,0.10)] dark:text-white'
                          : 'border-ink-900/[0.07] bg-white/45 text-ink-700 hover:border-brand-500/40 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.02] dark:text-ink-200 dark:hover:bg-white/[0.07]',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold',
                          isSelected
                            ? 'border-brand-500 bg-brand-500 text-white'
                            : 'border-ink-900/15 text-ink-500 group-hover:border-brand-400 dark:border-white/20 dark:text-ink-400',
                        )}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5" aria-hidden /> : option.id}
                      </span>
                      <span>{optionText(option, language)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-900/[0.06] pt-4 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={goPrevious}
                disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                className={cn(secondaryButton, 'px-3 py-2 text-[12px] disabled:opacity-40')}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                Previous
              </button>

              <button
                type="button"
                onClick={toggleReview}
                className={cn(
                  'press inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold ring-1 ring-inset',
                  isFlagged
                    ? 'bg-violet-600 text-white ring-violet-600'
                    : 'bg-violet-500/10 text-violet-700 ring-violet-600/20 dark:text-violet-300',
                )}
              >
                <Flag className="h-3.5 w-3.5" aria-hidden />
                {isFlagged ? 'Unmark review' : 'Mark for review'}
              </button>

              <button
                type="button"
                onClick={clearResponse}
                className={cn(secondaryButton, 'px-3 py-2 text-[12px]')}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Clear
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={
                  currentSectionIndex === paper.sections.length - 1 &&
                  currentQuestionIndex === currentSection.questions.length - 1
                }
                className={cn(secondaryButton, 'ml-auto px-3 py-2 text-[12px] disabled:opacity-40')}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </GlassCard>
        </section>

        <aside className="space-y-3">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                Question palette
              </p>
              <span className="font-mono text-[10.5px] font-semibold text-ink-500 dark:text-ink-400">
                {answeredCount}/{totalQuestions}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {currentSection.questions.map((question, index) => {
                const response = responses[question.id];
                const status = !response?.visited ? 'NOT_VISITED' : response.status;
                const isCurrent = index === currentQuestionIndex;
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => navigateTo(currentSectionIndex, index)}
                    aria-label={`Question ${index + 1}: ${status.replaceAll('_', ' ').toLowerCase()}`}
                    className={cn(
                      'press grid aspect-square place-items-center rounded-md border font-mono text-[10.5px] font-bold',
                      paletteStyles[status] ?? paletteStyles.NOT_VISITED,
                      isCurrent ? 'ring-2 ring-brand-500/70 ring-offset-1 ring-offset-transparent' : '',
                    )}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-medium text-ink-500 dark:text-ink-400">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Answered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Not answered
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Review
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-ink-300 dark:bg-white/25" /> Not visited
              </span>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-ink-600 dark:text-ink-300">Autosave</span>
              <span
                className={cn(
                  saveState === 'error'
                    ? 'text-rose-600 dark:text-rose-300'
                    : saveState === 'saving'
                      ? 'text-saffron-700 dark:text-saffron-300'
                      : 'text-emerald-700 dark:text-emerald-300',
                )}
              >
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                    ? 'Will retry on submit'
                    : 'Saved'}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-500 dark:text-ink-400">Answered</span>
                <span className="font-mono font-semibold text-ink-800 dark:text-ink-100">{answeredCount}</span>
              </div>
              <ProgressBar value={totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0} />
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-500 dark:text-ink-400">Marked for review</span>
                <span className="font-mono font-semibold text-ink-800 dark:text-ink-100">{reviewCount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-500 dark:text-ink-400">Visited</span>
                <span className="font-mono font-semibold text-ink-800 dark:text-ink-100">{visitedCount}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit(false)}
              disabled={submitting}
              className={cn(primaryButton, 'mt-4 w-full px-4 py-2.5 text-[12.5px] disabled:opacity-60')}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden />
              )}
              Submit test
            </button>

            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-500 dark:text-ink-400">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Answers are autosaved as you go.
            </p>
          </GlassCard>
        </aside>
      </main>
    </div>
  );
}

function ScreenState({
  title,
  description,
  isError = false,
  onRetry,
}: {
  title: string;
  description: string;
  isError?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <GlassCard className="w-full max-w-md p-7 text-center">
        <span
          className={cn(
            'mx-auto grid h-14 w-14 place-items-center rounded-2xl ring-1 ring-inset',
            isError
              ? 'bg-rose-500/12 text-rose-700 ring-rose-600/20 dark:text-rose-300'
              : 'bg-brand-500/12 text-brand-700 ring-brand-600/20 dark:text-brand-300',
          )}
        >
          {isError ? (
            <AlertTriangle className="h-6 w-6" aria-hidden />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          )}
        </span>
        <h1 className="mt-4 font-display text-xl font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">{description}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <button type="button" onClick={onRetry} className={cn(primaryButton, 'px-4 py-2 text-[12.5px]')}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Try again
            </button>
          ) : null}
          <Link href="/" className={cn(secondaryButton, 'px-4 py-2 text-[12.5px]')}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to dashboard
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}

function ResultScreen({ result, paper }: { result: Attempt; paper: PlayablePaper | null }) {
  const totalQuestions =
    paper?.sections.reduce((sum, section) => sum + section.questions.length, 0) ??
    result.responses?.length ??
    0;
  const correct = result.responses?.filter((response) => response.isCorrect === true).length ?? 0;
  const incorrect =
    result.responses?.filter(
      (response) => isAttemptResponseAnswered(response) && response.isCorrect === false,
    ).length ?? 0;
  const unattempted = Math.max(0, totalQuestions - correct - incorrect);
  const attempted = correct + incorrect;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const sections = result.sectionalScores ? Object.values(result.sectionalScores) : [];
  const scorePercent = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
  const [showSolutions, setShowSolutions] = useState(false);
  const [solutionFilter, setSolutionFilter] = useState<'all' | 'incorrect' | 'skipped'>('all');

  const allQuestions = useMemo(
    () => paper?.sections.flatMap((section) => section.questions) ?? [],
    [paper],
  );
  const responseByQuestion = useMemo(
    () => new Map((result.responses ?? []).map((response) => [response.questionId, response])),
    [result.responses],
  );
  const solutionItems = useMemo(
    () =>
      allQuestions
        .map((question) => ({ question, response: responseByQuestion.get(question.id) }))
        .filter(({ response }) => {
          if (solutionFilter === 'incorrect') {
            return isAttemptResponseAnswered(response) && response?.isCorrect === false;
          }
          if (solutionFilter === 'skipped') {
            return !isAttemptResponseAnswered(response);
          }
          return true;
        }),
    [allQuestions, responseByQuestion, solutionFilter],
  );

  return (
    <div className="mx-auto max-w-4xl px-3 py-8 sm:px-5">
      <GlassCard className="overflow-hidden p-0">
        <div className="relative overflow-hidden border-b border-ink-900/[0.06] bg-gradient-to-br from-brand-500/12 via-transparent to-saffron-400/15 px-5 py-8 text-center dark:border-white/10 sm:px-8">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-300">
            <Trophy className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.025em] text-ink-900 dark:text-white sm:text-3xl">
            Test submitted
          </h1>
          <p className="mt-1 text-[13px] text-ink-600 dark:text-ink-300">{paper?.title ?? 'Your mock test'}</p>

          <div className="mt-6 grid gap-2 sm:grid-cols-4">
            <StatCard icon={Target} label="Score" value={`${result.score}/${result.maxScore}`} note={`${scorePercent}%`} />
            <StatCard icon={CheckCircle2} label="Correct" value={String(correct)} tone="success" />
            <StatCard icon={XCircle} label="Incorrect" value={String(incorrect)} tone="danger" />
            <StatCard icon={Timer} label="Accuracy" value={`${accuracy}%`} note={`${attempted} attempted`} />
          </div>

          <div className="mx-auto mt-5 max-w-md">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink-600 dark:text-ink-300">
              <span>Score progress</span>
              <span className="font-mono">{scorePercent}%</span>
            </div>
            <ProgressBar value={scorePercent} tone="emerald" className="mt-2" />
            <p className="mt-2 text-[10.5px] text-ink-500 dark:text-ink-400">
              {unattempted} unattempted · {result.totalTimeSecs > 0 ? `${Math.round(result.totalTimeSecs / 60)} min spent` : 'time not recorded'}
              {result.percentile != null ? ` · ${result.percentile} percentile` : ''}
            </p>
          </div>
        </div>

        {sections.length > 0 ? (
          <div className="px-5 py-5 sm:px-8">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-ink-500 dark:text-ink-400" aria-hidden />
              <h2 className="text-sm font-bold text-ink-900 dark:text-white">Section breakdown</h2>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {sections.map((section) => (
                <div
                  key={section.sectionName}
                  className="rounded-xl border border-ink-900/[0.06] bg-white/45 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] font-semibold text-ink-800 dark:text-ink-100">
                      {section.sectionName}
                    </p>
                    <span className="font-mono text-[11px] font-bold text-ink-700 dark:text-ink-200">
                      {section.score}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-ink-500 dark:text-ink-400">
                    {section.correct} correct · {section.incorrect} incorrect · {section.unattempted} skipped
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {paper ? (
          <div className="border-t border-ink-900/[0.06] px-5 py-5 dark:border-white/10 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-ink-500 dark:text-ink-400" aria-hidden />
                <div>
                  <h2 className="text-sm font-bold text-ink-900 dark:text-white">Solutions &amp; explanations</h2>
                  <p className="mt-0.5 text-[10.5px] text-ink-500 dark:text-ink-400">
                    Correct option, your answer and the reasoning for every question.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSolutions((value) => !value)}
                className={cn(secondaryButton, 'px-3.5 py-2 text-[12px]')}
                aria-expanded={showSolutions}
              >
                {showSolutions ? 'Hide solutions' : 'Review solutions'}
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', showSolutions && 'rotate-180')}
                  aria-hidden
                />
              </button>
            </div>

            {showSolutions ? (
              <div className="mt-4">
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['all', 'All questions'],
                    ['incorrect', 'Incorrect only'],
                    ['skipped', 'Skipped only'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSolutionFilter(value)}
                      className={cn(
                        'press rounded-full px-3 py-1.5 text-[11px] font-semibold',
                        solutionFilter === value
                          ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                          : 'bg-ink-900/[0.05] text-ink-600 dark:bg-white/[0.06] dark:text-ink-300',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="ml-auto self-center font-mono text-[10.5px] text-ink-500 dark:text-ink-400">
                    {solutionItems.length} shown
                  </span>
                </div>

                <div className="mt-3 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                  {solutionItems.map(({ question, response }) => {
                    const statusLabel =
                      response?.isCorrect === true
                        ? 'Correct'
                        : isAttemptResponseAnswered(response)
                          ? 'Incorrect'
                          : 'Skipped';
                    const tone = statusLabel === 'Correct' ? 'success' : statusLabel === 'Incorrect' ? 'danger' : 'neutral';

                    return (
                      <div
                        key={question.id}
                        className="rounded-2xl border border-ink-900/[0.07] bg-white/45 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10.5px] font-bold text-ink-500 dark:text-ink-400">
                            Q{question.questionNumber}
                          </span>
                          <Badge>{question.subjectTag}</Badge>
                          <Badge tone={tone}>{statusLabel}</Badge>
                        </div>

                        <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-ink-900 dark:text-ink-100">
                          {question.text}
                        </p>

                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          {(Array.isArray(question.options) ? question.options : []).map((option) => {
                            const correctIds = question.correctOptionIds?.length
                              ? question.correctOptionIds
                              : question.correctOptionId
                                ? [question.correctOptionId]
                                : [];
                            const selectedIds = response?.selectedOptionIds?.length
                              ? response.selectedOptionIds
                              : response?.selectedOptionId
                                ? [response.selectedOptionId]
                                : [];
                            const isCorrect = correctIds.includes(option.id);
                            const isChosen = selectedIds.includes(option.id);
                            return (
                              <div
                                key={`${question.id}-${option.id}`}
                                className={cn(
                                  'flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] leading-snug',
                                  isCorrect
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                                    : isChosen
                                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                                      : 'border-ink-900/[0.07] text-ink-600 dark:border-white/[0.08] dark:text-ink-300',
                                )}
                              >
                                <span className="font-mono font-bold">{option.id}.</span>
                                <span className="min-w-0 flex-1">{option.text}</span>
                                {isCorrect ? <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> : null}
                                {isChosen && !isCorrect ? <XCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> : null}
                              </div>
                            );
                          })}
                        </div>

                        <p className="mt-2 text-[10.5px] font-medium text-ink-500 dark:text-ink-400">
                          Your answer:{' '}
                          {question.type === 'NUMERICAL'
                            ? (response?.selectedNumericalAnswer ?? 'Not attempted')
                            : response?.selectedOptionIds?.length
                              ? response.selectedOptionIds.join(', ')
                              : (response?.selectedOptionId ?? 'Not attempted')}{' '}
                          A� Correct answer:{' '}
                          <span className="font-bold text-ink-700 dark:text-ink-200">
                            {question.type === 'NUMERICAL'
                              ? (question.correctNumericalAnswer ?? '-')
                              : question.correctOptionIds?.length
                                ? question.correctOptionIds.join(', ')
                                : (question.correctOptionId ?? '-')}
                          </span>
                        </p>

                        <div className="mt-2 rounded-xl bg-ink-900/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
                          <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                            Explanation
                          </p>
                          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-700 dark:text-ink-200">
                            {question.explanation ||
                              question.explanationHindi ||
                              'Explanation will be added after review.'}
                          </p>
                          {question.explanation && question.explanationHindi ? (
                            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                              {question.explanationHindi}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {solutionItems.length === 0 ? (
                    <p className="rounded-xl border border-ink-900/[0.07] px-3 py-6 text-center text-[12px] text-ink-500 dark:border-white/[0.08] dark:text-ink-400">
                      No questions match this filter.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-ink-900/[0.06] px-5 py-4 dark:border-white/10 sm:px-8">
          <Link href="/" className={cn(primaryButton, 'px-4 py-2.5 text-[12.5px]')}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to dashboard
          </Link>
          {paper ? (
            <Link href={`/test/${paper.slug}`} className={cn(secondaryButton, 'px-4 py-2.5 text-[12.5px]')}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Take it again
            </Link>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone = 'brand',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
  tone?: 'brand' | 'success' | 'danger';
}) {
  return (
    <div className="rounded-xl border border-ink-900/[0.06] bg-white/55 px-3 py-3 text-center dark:border-white/10 dark:bg-white/[0.04]">
      <Icon
        className={cn(
          'mx-auto h-4 w-4',
          tone === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : tone === 'danger'
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-brand-600 dark:text-brand-300',
        )}
        aria-hidden
      />
      <p className="mt-1.5 font-display text-lg font-extrabold leading-none text-ink-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500 dark:text-ink-400">
        {label}
      </p>
      {note ? <p className="mt-0.5 text-[9.5px] text-ink-500 dark:text-ink-400">{note}</p> : null}
    </div>
  );
}
