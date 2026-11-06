import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserDashboard(userId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { userId, isCompleted: true },
      include: { paper: { select: { title: true, slug: true, examId: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 25,
    });

    const snapshots = await this.prisma.analyticsSnapshot.findMany({
      where: { userId },
      orderBy: { masteryScore: 'asc' },
    });

    const weakTopics = snapshots.filter((s) => s.masteryScore < 65).slice(0, 3);
    const strongTopics = [...snapshots].sort((a, b) => b.masteryScore - a.masteryScore).slice(0, 3);

    return {
      totalAttempts: attempts.length,
      recentAttempts: attempts,
      topicMastery: snapshots,
      weakTopics,
      strongTopics,
      recommendations: weakTopics.map((w) => ({
        topicTag: w.topicTag,
        subjectTag: w.subjectTag,
        message: `You are averaging ${w.accuracyPercent}% accuracy in ${w.topicTag}. Complete the targeted sectional drill and NCERT chapter revision.`,
      })),
    };
  }
}
