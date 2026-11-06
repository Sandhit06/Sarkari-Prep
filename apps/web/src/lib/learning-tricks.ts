import rawLearningTricks from "../../../../data/learning-tricks.json";

export type LearningTrickDifficulty = "EASY" | "MODERATE" | "HARD";
export type LearningTrickAccent = "brand" | "saffron" | "emerald" | "violet";

export type LearningTrick = {
  slug: string;
  title: string;
  subject: string;
  topic: string;
  examTags: string[];
  shortcut: string;
  explanation: string;
  example?: string;
  exampleHindi?: string;
  mnemonic?: string;
  difficulty: LearningTrickDifficulty;
  accent: LearningTrickAccent;
  sortOrder: number;
};

export const learningTricks = rawLearningTricks as LearningTrick[];

export const learningSubjects = [
  "ALL",
  ...Array.from(new Set(learningTricks.map((trick) => trick.subject))),
];
