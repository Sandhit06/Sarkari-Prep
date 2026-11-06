import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async listOpenQuestionIssues() {
    return this.prisma.questionIssue.findMany({
      include: { question: { select: { questionNumber: true, text: true, correctOptionId: true } } },
      orderBy: [{ isResolved: 'asc' }, { upvotes: 'desc' }],
    });
  }

  async reportQuestionIssue(payload: {
    questionId: string;
    reporterId?: string;
    issueType: string;
    suggestedOption?: string;
    comment: string;
  }) {
    return this.prisma.questionIssue.create({ data: payload });
  }

  async createTakedownReport(payload: {
    paperId: string;
    reporterEmail: string;
    reason: string;
    rightsAttested: boolean;
  }) {
    return this.prisma.takedownReport.create({ data: payload });
  }
}
