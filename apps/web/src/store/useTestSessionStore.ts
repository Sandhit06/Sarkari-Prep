import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuestionPaletteStatus, ProctorEventLog } from '@sarkariprep/shared-types';

export interface QuestionResponseState {
  selectedOptionId: string | null;
  status: QuestionPaletteStatus;
  timeSpentSecs: number;
  changedCount: number;
}

interface TestSessionState {
  attemptId: string | null;
  paperId: string | null;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  globalSecondsLeft: number;
  responses: Record<string, QuestionResponseState>;
  proctorEvents: ProctorEventLog[];
  selectOption: (questionId: string, optionId: string) => void;
  markForReview: (questionId: string) => void;
  clearResponse: (questionId: string) => void;
  logProctorEvent: (event: ProctorEventLog) => void;
  tickTimer: (currentQuestionId?: string) => void;
}

export const useTestSessionStore = create<TestSessionState>()(
  persist(
    (set) => ({
      attemptId: null,
      paperId: null,
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
      globalSecondsLeft: 3600,
      responses: {},
      proctorEvents: [],
      selectOption: (questionId, optionId) =>
        set((state) => {
          const prev = state.responses[questionId] || {
            selectedOptionId: null,
            status: 'NOT_ANSWERED',
            timeSpentSecs: 0,
            changedCount: 0,
          };
          return {
            responses: {
              ...state.responses,
              [questionId]: {
                ...prev,
                selectedOptionId: optionId,
                status: prev.status === 'MARKED_FOR_REVIEW' ? 'ANSWERED_AND_MARKED' : 'ANSWERED',
                changedCount: prev.selectedOptionId && prev.selectedOptionId !== optionId ? prev.changedCount + 1 : prev.changedCount,
              },
            },
          };
        }),
      markForReview: (questionId) =>
        set((state) => {
          const prev = state.responses[questionId];
          if (!prev) return state;
          return {
            responses: {
              ...state.responses,
              [questionId]: {
                ...prev,
                status: prev.selectedOptionId ? 'ANSWERED_AND_MARKED' : 'MARKED_FOR_REVIEW',
              },
            },
          };
        }),
      clearResponse: (questionId) =>
        set((state) => {
          const prev = state.responses[questionId];
          if (!prev) return state;
          return {
            responses: {
              ...state.responses,
              [questionId]: { ...prev, selectedOptionId: null, status: 'NOT_ANSWERED' },
            },
          };
        }),
      logProctorEvent: (ev) =>
        set((state) => ({ proctorEvents: [...state.proctorEvents, ev] })),
      tickTimer: (currentQuestionId) =>
        set((state) => {
          const nextGlobal = Math.max(0, state.globalSecondsLeft - 1);
          if (!currentQuestionId || !state.responses[currentQuestionId]) {
            return { globalSecondsLeft: nextGlobal };
          }
          const curResp = state.responses[currentQuestionId];
          return {
            globalSecondsLeft: nextGlobal,
            responses: {
              ...state.responses,
              [currentQuestionId]: {
                ...curResp,
                timeSpentSecs: curResp.timeSpentSecs + 1,
              },
            },
          };
        }),
    }),
    { name: 'sarkariprep-cbt-session' },
  ),
);
