import fs from "node:fs";
import path from "node:path";

const marks = (oneMark, twoMark) => [
  ...Array.from({ length: oneMark }, () => 1),
  ...Array.from({ length: twoMark }, () => 2),
];

const EXAMS = [
  {
    slug: "ssc-cgl",
    shortName: "SSC CGL",
    category: "SSC",
    negative: 0.5,
    sections: [
      { name: "General Intelligence & Reasoning", questions: 7 },
      { name: "General Awareness", questions: 6 },
      { name: "Quantitative Aptitude", questions: 6 },
      { name: "English Comprehension", questions: 6 },
    ],
  },
  {
    slug: "ssc-chsl",
    shortName: "SSC CHSL",
    category: "SSC",
    negative: 0.5,
    sections: [
      { name: "General Intelligence", questions: 7 },
      { name: "General Awareness", questions: 6 },
      { name: "Quantitative Aptitude", questions: 6 },
      { name: "English Language", questions: 6 },
    ],
  },
  {
    slug: "upsc-cse",
    shortName: "UPSC CSE",
    category: "UPSC",
    negative: 0.66,
    sections: [
      { name: "General Studies", questions: 15 },
      { name: "CSAT", questions: 10 },
    ],
  },
  {
    slug: "ibps-po",
    shortName: "IBPS PO",
    category: "BANKING",
    negative: 0.25,
    sections: [
      { name: "English Language", questions: 8 },
      { name: "Quantitative Aptitude", questions: 9 },
      { name: "Reasoning Ability", questions: 8 },
    ],
  },
  {
    slug: "sbi-clerk",
    shortName: "SBI Clerk",
    category: "BANKING",
    negative: 0.25,
    sections: [
      { name: "English Language", questions: 8 },
      { name: "Quantitative Aptitude", questions: 9 },
      { name: "Reasoning Ability", questions: 8 },
    ],
  },
  {
    slug: "rrb-ntpc",
    shortName: "RRB NTPC",
    category: "RAILWAYS",
    negative: 0.33,
    sections: [
      { name: "Mathematics", questions: 8 },
      { name: "General Intelligence & Reasoning", questions: 8 },
      { name: "General Awareness", questions: 9 },
    ],
  },
  {
    slug: "rrb-group-d",
    shortName: "RRB Group D",
    category: "RAILWAYS",
    negative: 0.33,
    sections: [
      { name: "Mathematics", questions: 8 },
      { name: "General Intelligence & Reasoning", questions: 8 },
      { name: "General Awareness", questions: 9 },
    ],
  },
  {
    slug: "wbpsc-wbcs",
    shortName: "WBCS",
    category: "STATE_PSC",
    negative: 0.33,
    sections: [
      { name: "General Studies", questions: 10 },
      { name: "English Composition", questions: 5 },
      { name: "Quantitative Aptitude", questions: 5 },
      { name: "Reasoning Ability", questions: 5 },
    ],
  },
  {
    slug: "wbpsc-clerk",
    shortName: "WBPSC Clerk",
    category: "STATE_PSC",
    negative: 0.25,
    sections: [
      { name: "General Studies", questions: 10 },
      { name: "Arithmetic", questions: 8 },
      { name: "English", questions: 7 },
    ],
  },
  {
    slug: "uppsc-pcs",
    shortName: "UPPSC PCS",
    category: "STATE_PSC",
    negative: 0.33,
    sections: [
      { name: "General Studies", questions: 15 },
      { name: "CSAT", questions: 10 },
    ],
  },
  {
    slug: "bpsc-cce",
    shortName: "BPSC",
    category: "STATE_PSC",
    negative: 0.33,
    sections: [
      { name: "General Studies", questions: 15 },
      { name: "CSAT", questions: 10 },
    ],
  },
  {
    slug: "ctet-paper-2",
    shortName: "CTET II",
    category: "TEACHING",
    negative: 0,
    sections: [
      { name: "Child Development & Pedagogy", questions: 7 },
      { name: "Mathematics", questions: 6 },
      { name: "Environmental Studies", questions: 6 },
      { name: "Language", questions: 6 },
    ],
  },
  {
    slug: "upsc-nda",
    shortName: "NDA",
    category: "DEFENCE",
    negative: 0.83,
    sections: [
      { name: "Mathematics", questions: 12 },
      { name: "General Ability Test", questions: 13 },
    ],
  },
  {
    slug: "ssc-mts",
    shortName: "SSC MTS",
    category: "SSC",
    negative: 1,
    sections: [
      { name: "Numerical Ability", questions: 7 },
      { name: "Reasoning Ability", questions: 6 },
      { name: "General Awareness", questions: 6 },
      { name: "English Language", questions: 6 },
    ],
  },
  {
    slug: "ssc-gd",
    shortName: "SSC GD",
    category: "SSC",
    negative: 0.25,
    sections: [
      { name: "Mathematics", questions: 8 },
      { name: "General Intelligence & Reasoning", questions: 8 },
      { name: "General Awareness", questions: 9 },
    ],
  },
  {
    slug: "rbi-grade-b",
    shortName: "RBI Grade B",
    category: "BANKING",
    negative: 0.25,
    sections: [
      { name: "General Awareness", questions: 9 },
      { name: "English Language", questions: 8 },
      { name: "Quantitative Aptitude", questions: 8 },
    ],
  },
  {
    slug: "sbi-po",
    shortName: "SBI PO",
    category: "BANKING",
    negative: 0.25,
    sections: [
      { name: "English Language", questions: 8 },
      { name: "Quantitative Aptitude", questions: 9 },
      { name: "Reasoning Ability", questions: 8 },
    ],
  },
  {
    slug: "ctet-paper-1",
    shortName: "CTET I",
    category: "TEACHING",
    negative: 0,
    sections: [
      { name: "Child Development & Pedagogy", questions: 7 },
      { name: "Mathematics", questions: 6 },
      { name: "Environmental Studies", questions: 6 },
      { name: "Language", questions: 6 },
    ],
  },
  {
    slug: "agniveer",
    shortName: "Agniveer",
    category: "DEFENCE",
    negative: 0.25,
    sections: [
      { name: "Mathematics", questions: 8 },
      { name: "General Intelligence & Reasoning", questions: 8 },
      { name: "General Awareness", questions: 9 },
    ],
  },
  {
    slug: "gate-cse",
    shortName: "GATE CSE",
    category: "ENGINEERING",
    negative: 0.33,
    sections: [
      {
        name: "General Aptitude",
        questions: 10,
        questionMarks: marks(5, 5),
      },
      {
        name: "Engineering Mathematics",
        questions: 13,
        questionMarks: marks(13, 0),
      },
      {
        name: "Computer Science & Information Technology",
        questions: 42,
        questionMarks: marks(12, 30),
      },
    ],
    sectional: [
      "General Aptitude",
      "Engineering Mathematics",
      "Digital Logic",
      "Computer Organization & Architecture",
      "Programming & Data Structures",
      "Algorithms",
      "Theory of Computation",
      "Compiler Design",
      "Operating Systems",
      "Databases",
      "Computer Networks",
    ],
  },
];

const TYPE_CYCLE = [
  "Full mock",
  "Full mock",
  "Full mock",
  "Full mock",
  "Full mock",
  "Full mock",
  "Sectional drill",
  "Sectional drill",
  "Sectional drill",
  "Sectional drill",
  "Sectional drill",
  "Sectional drill",
  "Speed test",
  "Speed test",
  "Speed test",
  "Speed test",
  "Speed test",
  "Speed test",
];

const catalog = [];

for (const exam of EXAMS) {
  for (let index = 0; index < TYPE_CYCLE.length; index += 1) {
    const number = index + 1;
    const type = TYPE_CYCLE[index];
    const isFull = type === "Full mock";
    const isSectional = type === "Sectional drill";
    const isGate = exam.slug === "gate-cse";
    const sectionalSubject = isGate
      ? exam.sectional[index % exam.sectional.length]
      : exam.sections[index % exam.sections.length].name;

    const questions = isGate
      ? isFull
        ? 65
        : isSectional
          ? 25
          : 20
      : isFull
        ? 25
        : isSectional
          ? 25
          : 20;
    const durationMins = isGate
      ? isFull
        ? 180
        : isSectional
          ? 30
          : 20
      : isFull
        ? 25
        : isSectional
          ? 20
          : 15;
    const sections = isFull
      ? exam.sections
      : [
          {
            name: isSectional
              ? sectionalSubject
              : isGate
                ? "Mixed GATE Drill"
                : "Mixed Speed Drill",
            questions,
          },
        ];

    catalog.push({
      slug: `${exam.slug}-practice-${String(number).padStart(2, "0")}`,
      title: `${exam.shortName} ${isFull ? "Full Mock" : isSectional ? "Sectional Drill" : "Speed Test"} ${String(
        number,
      ).padStart(2, "0")}`,
      examSlug: exam.slug,
      examShortName: exam.shortName,
      category: exam.category,
      year: 2025 - ((number - 1) % 3),
      shift: `Practice set ${String(number).padStart(2, "0")}`,
      type,
      questions,
      durationMins,
      marks: isGate && isFull ? 100 : questions,
      negative: exam.negative,
      bilingual: false,
      attempts: `${(1.1 + number * 0.27).toFixed(1)}k`,
      sections,
    });
  }
}

const outputPath = path.resolve("data/paper-catalog.json");
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${catalog.length} papers to ${outputPath}`);
