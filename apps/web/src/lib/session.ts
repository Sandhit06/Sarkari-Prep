import { createGuestSessionApi } from '@/lib/api';

const USER_KEY = 'sarkariprep:user-id';
const RESUME_KEY = 'sarkariprep:resume';

export type ResumeState = {
  attemptId: string;
  paperSlug: string;
  paperTitle: string;
  answered: number;
  total: number;
  secondsLeft: number;
  updatedAt: string;
};

function readStorage(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private mode; the session still works in memory.
  }
}

function removeStorage(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function getStoredUserId() {
  return readStorage(USER_KEY);
}

export function storeUserId(userId: string) {
  writeStorage(USER_KEY, userId);
}

export function getResumeState(): ResumeState | null {
  const raw = readStorage(RESUME_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ResumeState>;
    if (!parsed.attemptId || !parsed.paperSlug) return null;
    return {
      attemptId: parsed.attemptId,
      paperSlug: parsed.paperSlug,
      paperTitle: parsed.paperTitle ?? 'Mock test',
      answered: parsed.answered ?? 0,
      total: parsed.total ?? 0,
      secondsLeft: parsed.secondsLeft ?? 0,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveResumeState(state: ResumeState) {
  writeStorage(RESUME_KEY, JSON.stringify(state));
}

export function clearResumeState() {
  removeStorage(RESUME_KEY);
}

export async function ensureGuestUserId(): Promise<string> {
  const existing = getStoredUserId();
  if (existing) return existing;

  const session = await createGuestSessionApi();
  storeUserId(session.user.id);
  return session.user.id;
}
