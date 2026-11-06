import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ProctorEventType, QuestionType } from '@prisma/client';

export interface ResponsePayload {
  questionId: string;
  selectedOptionId: string | null;
  selectedOptionIds?: string[];
  selectedNumericalAnswer?: number | null;
  status: string;
  timeSpentSecs: number;
  flaggedForReview: boolean;
  changedAnswerCount: number;
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async resolvePaper(idOrSlug: string) {
    const paper = await this.prisma.paper.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { sections: { include: { questions: true } } },
    });
    if (!paper) throw new NotFoundException(`Paper "${idOrSlug}" not found`);
    return paper;
  }

  private async resolveUser(userId?: string) {
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      return user;
    }

    return this.prisma.user.create({
      data: {
        name: `Guest Aspirant #${Math.floor(1000 + Math.random() * 9000)}`,
        isGuest: true,
      },
    });
  }

  async startAttempt(userId: string | undefined, paperIdOrSlug: string) {
    const paper = await this.resolvePaper(paperIdOrSlug);
    const user = await this.resolveUser(userId);

    // A "Start" click on a paper the aspirant already opened should resume the
    // in-progress attempt instead of silently creating a second one.
    const existing = await this.prisma.attempt.findFirst({
      where: { userId: user.id, paperId: paper.id, isCompleted: false },
      orderBy: { startedAt: 'desc' },
    });

    if (existing) {
      return { ...existing, resumed: true };
    }

    const attempt = await this.prisma.attempt.create({
      data: {
        userId: user.id,
        paperId: paper.id,
        maxScore: paper.totalMarks,
      },
    });

    // Redis powers live timers/leaderboards, but a Redis outage must never stop
    // an aspirant from starting a test.
    try {
      await this.redis.cacheAttemptState(attempt.id, {
        attemptId: attempt.id,
        paperId: paper.id,
        startedAt: attempt.startedAt,
        responses: {},
      });
    } catch {
      // Cache is optional for the core attempt flow.
    }

    return { ...attempt, resumed: false };
  }

  async getAttempt(attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        responses: true,
        proctorEvents: { orderBy: { timestamp: 'asc' } },
        paper: {
          include: {
            exam: true,
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: {
                questions: { orderBy: { questionNumber: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return attempt;
  }

  async autosaveResponse(attemptId: string, payload: ResponsePayload) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { id: true, isCompleted: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.isCompleted) throw new BadRequestException('Attempt already submitted');

    return this.prisma.response.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId: payload.questionId,
        },
      },
      update: {
        selectedOptionId: payload.selectedOptionId,
        selectedOptionIds: payload.selectedOptionIds ?? [],
        selectedNumericalAnswer: payload.selectedNumericalAnswer ?? null,
        status: payload.status,
        timeSpentSecs: payload.timeSpentSecs,
        flaggedForReview: payload.flaggedForReview,
        changedAnswerCount: payload.changedAnswerCount,
      },
      create: {
        attemptId,
        questionId: payload.questionId,
        selectedOptionId: payload.selectedOptionId,
        selectedOptionIds: payload.selectedOptionIds ?? [],
        selectedNumericalAnswer: payload.selectedNumericalAnswer ?? null,
        status: payload.status,
        timeSpentSecs: payload.timeSpentSecs,
        flaggedForReview: payload.flaggedForReview,
        changedAnswerCount: payload.changedAnswerCount,
      },
    });
  }

  async logProctorEvent(attemptId: string, type: ProctorEventType, details?: string) {
    // Proportionate anti-cheat (§9): logged strictly for the user's personal post-test discipline report
    return this.prisma.proctorEvent.create({
      data: {
        attemptId,
        type,
        details,
      },
    });
  }

  private async saveResponses(attemptId: string, responses: ResponsePayload[]) {
    if (responses.length === 0) return;

    await this.prisma.$transaction(
      responses.map((payload) =>
        this.prisma.response.upsert({
          where: {
            attemptId_questionId: {
              attemptId,
              questionId: payload.questionId,
            },
          },
          update: {
            selectedOptionId: payload.selectedOptionId,
            selectedOptionIds: payload.selectedOptionIds ?? [],
            selectedNumericalAnswer: payload.selectedNumericalAnswer ?? null,
            status: payload.status,
            timeSpentSecs: payload.timeSpentSecs,
            flaggedForReview: payload.flaggedForReview,
            changedAnswerCount: payload.changedAnswerCount,
          },
          create: {
            attemptId,
            questionId: payload.questionId,
            selectedOptionId: payload.selectedOptionId,
            selectedOptionIds: payload.selectedOptionIds ?? [],
            selectedNumericalAnswer: payload.selectedNumericalAnswer ?? null,
            status: payload.status,
            timeSpentSecs: payload.timeSpentSecs,
            flaggedForReview: payload.flaggedForReview,
            changedAnswerCount: payload.changedAnswerCount,
          },
        }),
      ),
    );
  }

  async submitAndGradeAttempt(attemptId: string, pendingResponses?: ResponsePayload[]) {
    const existing = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { responses: true, proctorEvents: true },
    });
    if (!existing) throw new NotFoundException('Attempt not found');
    if (existing.isCompleted) return existing;

    const paper = await this.prisma.paper.findUnique({
      where: { id: existing.paperId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: { questions: { orderBy: { questionNumber: 'asc' } } },
        },
      },
    });
    if (!paper) throw new NotFoundException('Paper not found');

    const validQuestionIds = new Set(
      paper.sections.flatMap((section) => section.questions.map((question) => question.id)),
    );
    const responsesToSave = (pendingResponses ?? []).filter((response) =>
      validQuestionIds.has(response.questionId),
    );
    await this.saveResponses(attemptId, responsesToSave);

    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        responses: true,
        proctorEvents: true,
        paper: {
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: { questions: { orderBy: { questionNumber: 'asc' } } },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');

    const responseMap = new Map(attempt.responses.map((r) => [r.questionId, r]));
    let totalScore = 0;
    let maxScore = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalTimeSecs = 0;
    const sectionalScores: Record<string, unknown> = {};

    for (const section of attempt.paper.sections) {
      let secScore = 0;
      let secCorrect = 0;
      let secIncorrect = 0;
      let secUnattempted = 0;
      let secTime = 0;

      for (const q of section.questions) {
        maxScore += q.marks;
        const resp = responseMap.get(q.id);
        const timeSecs = resp?.timeSpentSecs || 0;
        secTime += timeSecs;
        totalTimeSecs += timeSecs;

        const hasResponse =
          resp &&
          (q.type === QuestionType.NUMERICAL
            ? resp.selectedNumericalAnswer != null
            : q.type === QuestionType.MULTI_CHOICE
              ? (resp.selectedOptionIds?.length ?? 0) > 0
              : resp.selectedOptionId != null);

        if (hasResponse && resp) {
          let isCorrect = false;
          if (q.type === QuestionType.NUMERICAL) {
            const tolerance = Math.abs(q.numericalTolerance ?? 0.01);
            isCorrect =
              q.correctNumericalAnswer != null &&
              resp.selectedNumericalAnswer != null &&
              Math.abs(resp.selectedNumericalAnswer - q.correctNumericalAnswer) <= tolerance;
          } else if (q.type === QuestionType.MULTI_CHOICE) {
            const expected = new Set(
              q.correctOptionIds.length
                ? q.correctOptionIds
                : q.correctOptionId
                  ? [q.correctOptionId]
                  : [],
            );
            const selected = new Set(resp.selectedOptionIds ?? []);
            isCorrect =
              expected.size === selected.size &&
              Array.from(expected).every((optionId) => selected.has(optionId));
          } else {
            isCorrect = resp.selectedOptionId === q.correctOptionId;
          }
          const delta = isCorrect ? q.marks : -q.negativeMarks;
          secScore += delta;
          totalScore += delta;
          if (isCorrect) {
            secCorrect++;
            totalCorrect++;
          } else {
            secIncorrect++;
            totalIncorrect++;
          }
          await this.prisma.response.update({
            where: { id: resp.id },
            data: { isCorrect, marksAwarded: delta },
          });
        } else {
          secUnattempted++;
        }
      }

      sectionalScores[section.id] = {
        sectionName: section.name,
        score: Number(secScore.toFixed(2)),
        correct: secCorrect,
        incorrect: secIncorrect,
        unattempted: secUnattempted,
        timeSecs: secTime,
      };
    }

    const attempted = totalCorrect + totalIncorrect;
    const accuracyPercent = attempted > 0 ? Number(((totalCorrect / attempted) * 100).toFixed(1)) : 0;

    let percentile = 85.0;
    try {
      percentile = await this.redis.recordPaperScoreAndGetPercentile(
        attempt.paperId,
        attempt.id,
        totalScore,
      );
    } catch {
      // Leaderboard caching is optional; grading still succeeds without Redis.
    }

    return this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: new Date(),
        isCompleted: true,
        totalTimeSecs,
        score: Number(totalScore.toFixed(2)),
        maxScore: Number(maxScore.toFixed(2)),
        accuracyPercent,
        percentile,
        sectionalScores: sectionalScores as object,
      },
      include: {
        responses: true,
        proctorEvents: true,
      },
    });
  }
}
