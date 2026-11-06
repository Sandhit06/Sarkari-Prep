import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PapersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(examSlug?: string, year?: number, isMock?: boolean) {
    return this.prisma.paper.findMany({
      where: {
        verificationStatus: 'PUBLISHED',
        ...(examSlug ? { exam: { slug: examSlug } } : {}),
        ...(year ? { year: Number(year) } : {}),
        ...(isMock !== undefined ? { isMock } : {}),
      },
      include: {
        exam: { include: { organization: true } },
        sections: {
          orderBy: { orderIndex: 'asc' },
          select: { id: true, name: true, timeLimitMins: true, positiveMarks: true, negativeMarks: true, _count: { select: { questions: true } } },
        },
      },
      orderBy: { year: 'desc' },
    });
  }

  async findPlayablePaperBySlugOrId(idOrSlug: string) {
    const paper = await this.prisma.paper.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        exam: true,
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            questions: {
              orderBy: { questionNumber: 'asc' },
            },
          },
        },
      },
    });
    if (!paper) throw new NotFoundException(`Paper "${idOrSlug}" not found`);
    return paper;
  }
}
