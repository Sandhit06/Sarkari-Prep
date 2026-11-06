const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type QuestionOption = {
  id: string;
  text: string;
  textHindi?: string | null;
};

export type PaperQuestion = {
  id: string;
  questionNumber: number;
  text: string;
  textHindi?: string | null;
  options: QuestionOption[];
  type?: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'NUMERICAL';
  correctOptionId?: string | null;
  correctOptionIds?: string[];
  correctNumericalAnswer?: number | null;
  numericalTolerance?: number | null;
  explanation?: string | null;
  explanationHindi?: string | null;
  subjectTag: string;
  topicTag: string;
  difficulty: string;
  marks: number;
  negativeMarks: number;
};

export type PaperSection = {
  id: string;
  name: string;
  orderIndex: number;
  timeLimitMins?: number | null;
  positiveMarks: number;
  negativeMarks: number;
  questions: PaperQuestion[];
};

export type PlayablePaper = {
  id: string;
  slug: string;
  title: string;
  year: number;
  shift?: string | null;
  durationMinutes: number;
  totalMarks: number;
  hasSectionalTiming: boolean;
  exam?: { shortName: string; name: string } | null;
  sections: PaperSection[];
};

export type AttemptResponse = {
  id?: string;
  questionId: string;
  selectedOptionId: string | null;
  selectedOptionIds?: string[];
  selectedNumericalAnswer?: number | null;
  status: string;
  timeSpentSecs: number;
  flaggedForReview: boolean;
  changedAnswerCount: number;
  isCorrect?: boolean | null;
  marksAwarded?: number;
};

export type SectionalScore = {
  sectionName: string;
  score: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  timeSecs: number;
};

export type Attempt = {
  id: string;
  userId: string;
  paperId: string;
  startedAt: string;
  submittedAt?: string | null;
  isCompleted: boolean;
  totalTimeSecs: number;
  score: number;
  maxScore: number;
  accuracyPercent: number;
  percentile?: number | null;
  sectionalScores?: Record<string, SectionalScore> | null;
  responses?: AttemptResponse[];
  paper?: PlayablePaper | null;
  resumed?: boolean;
};

export type ResponseInput = {
  questionId: string;
  selectedOptionId: string | null;
  selectedOptionIds?: string[];
  selectedNumericalAnswer?: number | null;
  status: string;
  timeSpentSecs: number;
  flaggedForReview: boolean;
  changedAnswerCount: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchExams(category?: string, query?: string) {
  const params = new URLSearchParams();
  if (category && category !== 'ALL') params.set('category', category);
  if (query) params.set('q', query);
  const res = await fetch(`${API_BASE}/exams?${params.toString()}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to fetch exams');
  return res.json();
}

export async function fetchPapers(examSlug?: string, year?: number) {
  const params = new URLSearchParams();
  if (examSlug && examSlug !== 'ALL') params.set('examSlug', examSlug);
  if (year) params.set('year', String(year));
  const res = await fetch(`${API_BASE}/papers?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch papers');
  return res.json();
}

export function createGuestSessionApi() {
  return request<{ user: { id: string; name: string }; token: string }>('/auth/guest', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function fetchPaperApi(idOrSlug: string) {
  return request<PlayablePaper>(`/papers/${encodeURIComponent(idOrSlug)}`);
}

export function startAttemptApi(userId: string | undefined, paperId: string) {
  return request<Attempt>('/attempts/start', {
    method: 'POST',
    body: JSON.stringify({ userId, paperId }),
  });
}

export function getAttemptApi(attemptId: string) {
  return request<Attempt>(`/attempts/${encodeURIComponent(attemptId)}`);
}

export function autosaveResponseApi(attemptId: string, payload: ResponseInput) {
  return request<AttemptResponse>(`/attempts/${encodeURIComponent(attemptId)}/response`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function logProctorEventApi(
  attemptId: string,
  type: string,
  details?: string,
) {
  return request(`/attempts/${encodeURIComponent(attemptId)}/proctor-event`, {
    method: 'POST',
    body: JSON.stringify({ type, details }),
  });
}

export function submitAttemptApi(attemptId: string, responses: ResponseInput[]) {
  return request<Attempt>(`/attempts/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ responses }),
  });
}
