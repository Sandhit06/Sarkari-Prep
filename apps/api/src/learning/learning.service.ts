import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: { subject?: string; exam?: string; q?: string; take?: number } = {}) {
    const take = Math.min(Math.max(options.take ?? 50, 1), 100);
    const search = options.q?.trim();

    return this.prisma.learningTrick.findMany({
      where: {
        isPublished: true,
        ...(options.subject && options.subject !== 'ALL'
          ? { subject: options.subject }
          : {}),
        ...(options.exam ? { examTags: { has: options.exam } } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { topic: { contains: search, mode: 'insensitive' } },
                { shortcut: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take,
    });
  }

  async findBySlug(slug: string) {
    const trick = await this.prisma.learningTrick.findUnique({ where: { slug } });
    if (!trick || !trick.isPublished) {
      throw new NotFoundException(`Learning trick "${slug}" not found`);
    }
    return trick;
  }
}
