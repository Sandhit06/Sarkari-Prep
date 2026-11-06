import rawCatalog from "../../../../data/paper-catalog.json";
import type { ExamCategory, Paper } from "@/lib/data";

export type CatalogPaper = Paper & {
  examSlug: string;
  examShortName: string;
  category: ExamCategory;
  sections: Array<{ name: string; questions: number }>;
};

export const paperCatalog = rawCatalog as CatalogPaper[];

export const paperCatalogCount = paperCatalog.length;

export const papersPerExam = Array.from(
  paperCatalog.reduce((counts, paper) => {
    counts.set(paper.examSlug, (counts.get(paper.examSlug) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()),
).map(([examSlug, count]) => ({
  examSlug,
  exam: paperCatalog.find((paper) => paper.examSlug === examSlug)?.examShortName ?? examSlug,
  count,
}));
