import {
  PrismaClient,
  ExamCategory,
  VerificationStatus,
  PaperSourceType,
  DifficultyLevel,
  IngestionSourceKind,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { buildPracticeQuestions } from './practice-papers';
import { buildGateQuestions } from './gate-papers';

const prisma = new PrismaClient();

type DemoOption = { id: string; text: string; textHindi?: string };
type DemoQuestion = {
  text: string;
  textHindi?: string;
  options: DemoOption[];
  correctOptionId: string;
  explanation: string;
  subjectTag: string;
  topicTag: string;
};

const DEMO_QUESTION_BANK: DemoQuestion[] = [
  {
    text: 'Which Article of the Constitution of India provides for the appointment of a Finance Commission?',
    textHindi: 'भारतीय संविधान का कौन सा अनुच्छेद वित्त आयोग की नियुक्ति का प्रावधान करता है?',
    options: [
      { id: 'A', text: 'Article 275', textHindi: 'अनुच्छेद 275' },
      { id: 'B', text: 'Article 280', textHindi: 'अनुच्छेद 280' },
      { id: 'C', text: 'Article 300A', textHindi: 'अनुच्छेद 300A' },
      { id: 'D', text: 'Article 315', textHindi: 'अनुच्छेद 315' },
    ],
    correctOptionId: 'B',
    explanation: 'Article 280 requires the President to constitute a Finance Commission every five years.',
    subjectTag: 'General Awareness',
    topicTag: 'Indian Polity',
  },
  {
    text: 'Select the number that replaces the question mark: 7, 15, 31, 63, 127, ?',
    textHindi: 'प्रश्न चिह्न के स्थान पर कौन-सी संख्या आएगी: 7, 15, 31, 63, 127, ?',
    options: [
      { id: 'A', text: '254', textHindi: '254' },
      { id: 'B', text: '255', textHindi: '255' },
      { id: 'C', text: '256', textHindi: '256' },
      { id: 'D', text: '248', textHindi: '248' },
    ],
    correctOptionId: 'B',
    explanation: 'The pattern is (x × 2 + 1): 127 × 2 + 1 = 255.',
    subjectTag: 'Reasoning',
    topicTag: 'Number Series',
  },
  {
    text: 'Choose the synonym of the word "Abundant".',
    textHindi: '"Abundant" शब्द का समानार्थी चुनें।',
    options: [
      { id: 'A', text: 'Scarce', textHindi: 'दुर्लभ' },
      { id: 'B', text: 'Plentiful', textHindi: 'प्रचुर' },
      { id: 'C', text: 'Fragile', textHindi: 'नाज़ुक' },
      { id: 'D', text: 'Rapid', textHindi: 'तेज़' },
    ],
    correctOptionId: 'B',
    explanation: 'Abundant means existing in large quantities; plentiful is its synonym.',
    subjectTag: 'English',
    topicTag: 'Vocabulary',
  },
  {
    text: 'If the ratio of cost price to selling price of an article is 5 : 6, what is the profit percentage?',
    textHindi: 'यदि किसी वस्तु के क्रय मूल्य और विक्रय मूल्य का अनुपात 5 : 6 है, तो लाभ प्रतिशत क्या है?',
    options: [
      { id: 'A', text: '16.67%', textHindi: '16.67%' },
      { id: 'B', text: '20%', textHindi: '20%' },
      { id: 'C', text: '25%', textHindi: '25%' },
      { id: 'D', text: '15%', textHindi: '15%' },
    ],
    correctOptionId: 'B',
    explanation: 'Profit % = ((6 − 5) / 5) × 100 = 20%.',
    subjectTag: 'Quantitative Aptitude',
    topicTag: 'Profit and Loss',
  },
  {
    text: 'Which Article of the Constitution guarantees equality before the law?',
    textHindi: 'संविधान का कौन सा अनुच्छेद कानून के समक्ष समानता की गारंटी देता है?',
    options: [
      { id: 'A', text: 'Article 14', textHindi: 'अनुच्छेद 14' },
      { id: 'B', text: 'Article 19', textHindi: 'अनुच्छेद 19' },
      { id: 'C', text: 'Article 21', textHindi: 'अनुच्छेद 21' },
      { id: 'D', text: 'Article 32', textHindi: 'अनुच्छेद 32' },
    ],
    correctOptionId: 'A',
    explanation: 'Article 14 guarantees equality before the law and equal protection of the laws.',
    subjectTag: 'General Awareness',
    topicTag: 'Indian Polity',
  },
  {
    text: 'A train covers 60 km in 45 minutes. What is its average speed?',
    textHindi: 'एक ट्रेन 45 मिनट में 60 किमी की दूरी तय करती है। उसकी औसत गति क्या है?',
    options: [
      { id: 'A', text: '60 km/h', textHindi: '60 किमी/घंटा' },
      { id: 'B', text: '75 km/h', textHindi: '75 किमी/घंटा' },
      { id: 'C', text: '80 km/h', textHindi: '80 किमी/घंटा' },
      { id: 'D', text: '90 km/h', textHindi: '90 किमी/घंटा' },
    ],
    correctOptionId: 'C',
    explanation: 'Speed = distance / time = 60 / 0.75 = 80 km/h.',
    subjectTag: 'Quantitative Aptitude',
    topicTag: 'Time, Speed and Distance',
  },
  {
    text: 'Choose the correctly spelt word.',
    textHindi: 'सही वर्तनी वाला शब्द चुनें।',
    options: [
      { id: 'A', text: 'Accomodation', textHindi: 'Accomodation' },
      { id: 'B', text: 'Accommodation', textHindi: 'Accommodation' },
      { id: 'C', text: 'Acommodation', textHindi: 'Acommodation' },
      { id: 'D', text: 'Accommodetion', textHindi: 'Accommodetion' },
    ],
    correctOptionId: 'B',
    explanation: 'The correct spelling is "Accommodation" (double c, double m).',
    subjectTag: 'English',
    topicTag: 'Spelling',
  },
  {
    text: 'Which is the largest ocean on Earth?',
    textHindi: 'पृथ्वी पर सबसे बड़ा महासागर कौन सा है?',
    options: [
      { id: 'A', text: 'Atlantic Ocean', textHindi: 'अटलांटिक महासागर' },
      { id: 'B', text: 'Indian Ocean', textHindi: 'हिंद महासागर' },
      { id: 'C', text: 'Pacific Ocean', textHindi: 'प्रशांत महासागर' },
      { id: 'D', text: 'Arctic Ocean', textHindi: 'आर्कटिक महासागर' },
    ],
    correctOptionId: 'C',
    explanation: 'The Pacific Ocean is the largest and deepest ocean on Earth.',
    subjectTag: 'General Awareness',
    topicTag: 'Geography',
  },
];

type DemoSection = { name: string; questions: number; timeLimitMins?: number };

type DemoPaper = {
  slug: string;
  title: string;
  examSlug: string;
  year: number;
  shift: string;
  isMock: boolean;
  isSectional: boolean;
  durationMinutes: number;
  totalMarks: number;
  hasSectionalTiming: boolean;
  marks: number;
  negativeMarks: number;
  sections: DemoSection[];
};

const DEMO_PAPERS: DemoPaper[] = [
  {
    slug: 'ssc-cgl-2024-t1-s1',
    title: 'SSC CGL 2024 — Tier I, Shift 1',
    examSlug: 'ssc-cgl',
    year: 2024,
    shift: 'Shift 1',
    isMock: false,
    isSectional: false,
    durationMinutes: 60,
    totalMarks: 200,
    hasSectionalTiming: false,
    marks: 2,
    negativeMarks: 0.5,
    sections: [
      { name: 'General Intelligence & Reasoning', questions: 25 },
      { name: 'General Awareness', questions: 25 },
      { name: 'Quantitative Aptitude', questions: 25 },
      { name: 'English Comprehension', questions: 25 },
    ],
  },
  {
    slug: 'ibps-po-2024-prelims',
    title: 'IBPS PO 2024 — Prelims (Sectional)',
    examSlug: 'ibps-po',
    year: 2024,
    shift: 'Full length',
    isMock: true,
    isSectional: true,
    durationMinutes: 60,
    totalMarks: 100,
    hasSectionalTiming: true,
    marks: 1,
    negativeMarks: 0.25,
    sections: [
      { name: 'English Language', questions: 30, timeLimitMins: 20 },
      { name: 'Quantitative Aptitude', questions: 35, timeLimitMins: 20 },
      { name: 'Reasoning Ability', questions: 35, timeLimitMins: 20 },
    ],
  },
  {
    slug: 'upsc-cse-2024-gs1',
    title: 'UPSC CSE 2024 — GS Paper I',
    examSlug: 'upsc-cse',
    year: 2024,
    shift: 'Prelims',
    isMock: false,
    isSectional: false,
    durationMinutes: 120,
    totalMarks: 200,
    hasSectionalTiming: false,
    marks: 2,
    negativeMarks: 0.66,
    sections: [
      { name: 'General Studies', questions: 50 },
      { name: 'CSAT', questions: 50 },
    ],
  },
  {
    slug: 'rrb-ntpc-2022-cbt1',
    title: 'RRB NTPC 2022 — CBT 1',
    examSlug: 'rrb-ntpc',
    year: 2022,
    shift: 'CBT 1',
    isMock: false,
    isSectional: false,
    durationMinutes: 90,
    totalMarks: 100,
    hasSectionalTiming: false,
    marks: 1,
    negativeMarks: 0.33,
    sections: [
      { name: 'Mathematics', questions: 30 },
      { name: 'General Intelligence & Reasoning', questions: 30 },
      { name: 'General Awareness', questions: 40 },
    ],
  },
  {
    slug: 'wbpsc-wbcs-2023-prelims',
    title: 'WBPSC WBCS 2023 — Prelims',
    examSlug: 'wbpsc-wbcs',
    year: 2023,
    shift: 'Prelims',
    isMock: false,
    isSectional: false,
    durationMinutes: 150,
    totalMarks: 200,
    hasSectionalTiming: false,
    marks: 1,
    negativeMarks: 0.33,
    sections: [
      { name: 'English Composition', questions: 50 },
      { name: 'General Science & Knowledge', questions: 50 },
      { name: 'Quantitative Aptitude', questions: 50 },
      { name: 'Reasoning Ability', questions: 50 },
    ],
  },
  {
    slug: 'wbpsc-clerk-2024-part1',
    title: 'WBPSC Clerk 2024 — Part I',
    examSlug: 'wbpsc-clerk',
    year: 2024,
    shift: 'Part I',
    isMock: true,
    isSectional: false,
    durationMinutes: 90,
    totalMarks: 100,
    hasSectionalTiming: false,
    marks: 1,
    negativeMarks: 0.25,
    sections: [
      { name: 'General Studies', questions: 40 },
      { name: 'Arithmetic', questions: 30 },
      { name: 'English', questions: 30 },
    ],
  },
  {
    slug: 'ssc-cgl-quant-drill',
    title: 'Quantitative Aptitude — Speed drill',
    examSlug: 'ssc-cgl',
    year: 2024,
    shift: '25 questions',
    isMock: true,
    isSectional: true,
    durationMinutes: 15,
    totalMarks: 50,
    hasSectionalTiming: false,
    marks: 2,
    negativeMarks: 0.5,
    sections: [{ name: 'Quantitative Aptitude', questions: 25 }],
  },
];

type CatalogSection = { name: string; questions: number; questionMarks?: number[] };

type CatalogPaper = {
  slug: string;
  title: string;
  examSlug: string;
  examShortName: string;
  category: string;
  year: number;
  shift: string;
  type: 'Full mock' | 'Sectional drill' | 'Speed test';
  questions: number;
  durationMins: number;
  marks: number;
  negative: number;
  bilingual: boolean;
  attempts: string;
  sections: CatalogSection[];
};

async function seedCatalogPapers(uploaderId: string) {
  const catalogPath = path.resolve(__dirname, '../../../data/paper-catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as CatalogPaper[];

  let created = 0;
  let repaired = 0;
  let updated = 0;
  let skipped = 0;

  for (const [index, item] of catalog.entries()) {
    const exam = await prisma.exam.findUnique({ where: { slug: item.examSlug } });
    if (!exam) {
      skipped += 1;
      console.warn(`Skipping ${item.slug}: exam ${item.examSlug} not found`);
      continue;
    }

    const isGate = item.examSlug === 'gate-cse';
    let nextQuestionNumber = 1;
    const sections = item.sections.map((section, sectionIndex) => {
      const questions = isGate
        ? buildGateQuestions(
            section.name,
            section.questions,
            1,
            item.negative,
            nextQuestionNumber,
            index + 1,
            section.questionMarks,
          )
        : buildPracticeQuestions(
            section.name,
            section.questions,
            1,
            item.negative,
            nextQuestionNumber,
            index + 1,
          );
      nextQuestionNumber += section.questions;

      return {
        name: section.name,
        orderIndex: sectionIndex + 1,
        timeLimitMins: item.sections.length === 1 ? item.durationMins : undefined,
        positiveMarks: 1,
        negativeMarks: item.negative,
        questions: { create: questions },
      };
    });

    const paperData = {
      title: item.title,
      examId: exam.id,
      year: item.year,
      shift: item.shift,
      language: 'en',
      isMock: item.type !== 'Sectional drill',
      isSectional: item.type !== 'Full mock',
      sourceType: PaperSourceType.MEMORY_BASED,
      verificationStatus: VerificationStatus.PUBLISHED,
      durationMinutes: item.durationMins,
      totalMarks: item.marks,
      hasSectionalTiming: false,
    };

    const existing = await prisma.paper.findUnique({
      where: { slug: item.slug },
      select: { id: true, _count: { select: { sections: true } } },
    });

    if (!existing) {
      await prisma.paper.create({
        data: {
          slug: item.slug,
          ...paperData,
          uploaderId,
          sections: { create: sections },
        },
      });
      created += 1;
      continue;
    }

    await prisma.paper.update({ where: { id: existing.id }, data: paperData });

    if (existing._count.sections === 0) {
      await prisma.paper.update({
        where: { id: existing.id },
        data: { sections: { create: sections } },
      });
      repaired += 1;
    } else {
      updated += 1;
    }
  }

  console.log(
    `Seeded paper catalog: ${created} created, ${repaired} repaired, ${updated} updated, ${skipped} skipped.`,
  );
}

function buildQuestions(
  sectionName: string,
  count: number,
  marks: number,
  negativeMarks: number,
  startNumber: number,
) {
  return Array.from({ length: count }, (_, index) => {
    const template = DEMO_QUESTION_BANK[(startNumber + index) % DEMO_QUESTION_BANK.length];
    return {
      questionNumber: startNumber + index,
      text: template.text,
      textHindi: template.textHindi,
      options: template.options,
      correctOptionId: template.correctOptionId,
      explanation: template.explanation,
      subjectTag: sectionName,
      topicTag: template.topicTag,
      marks,
      negativeMarks,
      sourceConfidence: 1,
    };
  });
}

async function main() {
  console.log('🌱 Seeding SarkariPrep PostgreSQL Database...');
  const seedPath = path.resolve(__dirname, '../../../data/exams-seed.json');
  const data = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  // 1. Seed Organizations & Exams
  for (const org of data.organizations) {
    const createdOrg = await prisma.organization.upsert({
      where: { slug: org.slug },
      update: { name: org.name, shortName: org.shortName, websiteUrl: org.websiteUrl, isStateBody: org.isStateBody },
      create: { slug: org.slug, name: org.name, shortName: org.shortName, websiteUrl: org.websiteUrl, isStateBody: org.isStateBody },
    });

    for (const exam of org.exams) {
      const createdExam = await prisma.exam.upsert({
        where: { slug: exam.slug },
        update: {
          name: exam.name,
          shortName: exam.shortName,
          category: exam.category as ExamCategory,
          eligibilitySummary: exam.eligibility,
          ageLimit: exam.ageLimit,
          qualification: exam.eligibility,
          hasSectionalTiming: exam.hasSectionalTiming,
          defaultDurationMins: exam.durationMins,
          defaultTotalMarks: exam.totalMarks,
          defaultNegativeMark: exam.negativeMark,
        },
        create: {
          slug: exam.slug,
          name: exam.name,
          shortName: exam.shortName,
          category: exam.category as ExamCategory,
          organizationId: createdOrg.id,
          eligibilitySummary: exam.eligibility,
          ageLimit: exam.ageLimit,
          qualification: exam.eligibility,
          hasSectionalTiming: exam.hasSectionalTiming,
          defaultDurationMins: exam.durationMins,
          defaultTotalMarks: exam.totalMarks,
          defaultNegativeMark: exam.negativeMark,
          languagesSupported: ['en', 'hi', 'bn'],
        },
      });

      // Seed 2024 ExamCycle
      await prisma.examCycle.upsert({
        where: { examId_year: { examId: createdExam.id, year: 2024 } },
        update: {},
        create: {
          examId: createdExam.id,
          year: 2024,
          vacanciesCount: 5000,
          officialPdfUrl: org.websiteUrl,
        },
      });
    }
  }

  // 2. Seed Default Demo Aspirant & Moderator Users
  const aspirant = await prisma.user.upsert({
    where: { email: 'arjun@sarkariprep.org' },
    update: {},
    create: {
      email: 'arjun@sarkariprep.org',
      name: 'Arjun Kumar',
      role: 'ASPIRANT',
      reputationPoints: 420,
      profile: {
        create: {
          targetExamSlugs: ['ssc-cgl', 'upsc-cse', 'wbpsc-wbcs'],
          preferredLanguage: 'en',
          stateDomicile: 'WB',
          dailyGoalMinutes: 120,
        },
      },
    },
  });

  // 3. Seed playable demo papers for every mock-test card in the web app.
  // These slugs must match apps/web/src/lib/data.ts so "Start" opens a real test.
  for (const demo of DEMO_PAPERS) {
    const exam = await prisma.exam.findUnique({ where: { slug: demo.examSlug } });
    if (!exam) {
      console.warn(`Skipping ${demo.slug}: exam ${demo.examSlug} not found`);
      continue;
    }

    let nextQuestionNumber = 1;
    const sections = demo.sections.map((section, index) => {
      const questions = buildQuestions(
        section.name,
        section.questions,
        demo.marks,
        demo.negativeMarks,
        nextQuestionNumber,
      );
      nextQuestionNumber += section.questions;

      return {
        name: section.name,
        orderIndex: index + 1,
        timeLimitMins: section.timeLimitMins,
        positiveMarks: demo.marks,
        negativeMarks: demo.negativeMarks,
        questions: { create: questions },
      };
    });

    const paper = await prisma.paper.upsert({
      where: { slug: demo.slug },
      update: {
        title: demo.title,
        examId: exam.id,
        year: demo.year,
        shift: demo.shift,
        language: 'en-hi',
        isMock: demo.isMock,
        isSectional: demo.isSectional,
        sourceType: demo.isMock ? PaperSourceType.MEMORY_BASED : PaperSourceType.OFFICIAL,
        verificationStatus: VerificationStatus.PUBLISHED,
        durationMinutes: demo.durationMinutes,
        totalMarks: demo.totalMarks,
        hasSectionalTiming: demo.hasSectionalTiming,
      },
      create: {
        slug: demo.slug,
        title: demo.title,
        examId: exam.id,
        year: demo.year,
        shift: demo.shift,
        language: 'en-hi',
        isMock: demo.isMock,
        isSectional: demo.isSectional,
        sourceType: demo.isMock ? PaperSourceType.MEMORY_BASED : PaperSourceType.OFFICIAL,
        verificationStatus: VerificationStatus.PUBLISHED,
        durationMinutes: demo.durationMinutes,
        totalMarks: demo.totalMarks,
        hasSectionalTiming: demo.hasSectionalTiming,
        uploaderId: aspirant.id,
        sections: { create: sections },
      },
      include: { _count: { select: { sections: true } } },
    });

    // Repair papers created by older seeds that have no sections/questions yet.
    if (paper._count.sections === 0) {
      await prisma.paper.update({
        where: { id: paper.id },
        data: { sections: { create: sections } },
      });
    }
  }

  // 4. Seed the full 342-paper catalog with equal coverage for every web exam.
  await seedCatalogPapers(aspirant.id);

  // 5. Seed shortcut / learning tricks shown in the learning feed.
  const tricksPath = path.resolve(__dirname, '../../../data/learning-tricks.json');
  const tricks = JSON.parse(fs.readFileSync(tricksPath, 'utf-8'));
  for (const trick of tricks) {
    const payload = {
      title: trick.title,
      subject: trick.subject,
      topic: trick.topic,
      examTags: trick.examTags ?? [],
      shortcut: trick.shortcut,
      explanation: trick.explanation,
      example: trick.example ?? null,
      exampleHindi: trick.exampleHindi ?? null,
      mnemonic: trick.mnemonic ?? null,
      difficulty: (trick.difficulty ?? 'MODERATE') as DifficultyLevel,
      accent: trick.accent ?? 'brand',
      sourceUrl: trick.sourceUrl ?? null,
      sortOrder: trick.sortOrder ?? 0,
      isPublished: true,
    };

    await prisma.learningTrick.upsert({
      where: { slug: trick.slug },
      update: payload,
      create: { slug: trick.slug, ...payload },
    });
  }

  // 6. Seed official ingestion sources for the knowledge brain.
  const sourcesPath = path.resolve(__dirname, '../../../data/ingestion-sources.json');
  const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
  for (const source of sources) {
    const payload = {
      name: source.name,
      kind: (source.kind ?? 'OFFICIAL_HTML') as IngestionSourceKind,
      url: source.url,
      examSlug: source.examSlug ?? null,
      organizationSlug: source.organizationSlug ?? null,
      enabled: source.enabled ?? true,
      cadenceMinutes: source.cadenceMinutes ?? 1440,
      trustScore: source.trustScore ?? 0.7,
    };

    await prisma.ingestionSource.upsert({
      where: { slug: source.slug },
      update: payload,
      create: { slug: source.slug, ...payload, nextRunAt: new Date() },
    });
  }

  console.log('✅ Database seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
