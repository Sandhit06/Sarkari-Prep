export type ExamCategory =
  | 'SSC'
  | 'BANKING'
  | 'RAILWAYS'
  | 'UPSC'
  | 'DEFENCE'
  | 'TEACHING'
  | 'STATE_PSC'
  | 'ENGINEERING';

export type ExamQuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'NUMERICAL';

export type QuestionPaletteStatus =
  | 'NOT_VISITED'
  | 'NOT_ANSWERED'
  | 'ANSWERED'
  | 'MARKED_FOR_REVIEW'
  | 'ANSWERED_AND_MARKED';

export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  textHindi?: string;
}

export interface ExamQuestion {
  id: string;
  questionNumber: number;
  sectionId: string;
  sectionName: string;
  text: string;
  textHindi?: string;
  options: QuestionOption[];
  type: ExamQuestionType;
  correctOptionId: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  correctOptionIds: Array<'A' | 'B' | 'C' | 'D' | 'E'>;
  correctNumericalAnswer: number | null;
  numericalTolerance: number | null;
  explanation: string;
  explanationHindi?: string;
  subjectTag: string;
  topicTag: string;
  difficulty: 'EASY' | 'MODERATE' | 'HARD';
  marks: number;
  negativeMarks: number;
  sourceConfidence: number;
}

export interface ProctorEventLog {
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'COPY_ATTEMPT' | 'PASTE_ATTEMPT' | 'RIGHT_CLICK';
  timestamp: string;
  note: string;
}
