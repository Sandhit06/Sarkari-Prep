import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExamCategory } from '@prisma/client';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(category?: ExamCategory, search?: string) {
    return this.prisma.exam.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { shortName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        organization: true,
        cycles: { orderBy: { year: 'desc' }, take: 1 },
        _count: { select: { papers: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { slug },
      include: {
        organization: true,
        cycles: { orderBy: { year: 'desc' } },
        syllabi: true,
        prepGuides: true,
        papers: {
          where: { verificationStatus: 'PUBLISHED' },
          orderBy: { year: 'desc' },
        },
      },
    });
    if (!exam) throw new NotFoundException(`Exam "${slug}" not found`);
    return exam;
  }
}
