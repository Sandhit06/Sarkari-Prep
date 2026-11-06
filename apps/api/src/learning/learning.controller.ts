import { Controller, Get, Param, Query } from '@nestjs/common';
import { LearningService } from './learning.service';

@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get()
  findAll(
    @Query('subject') subject?: string,
    @Query('exam') exam?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.learningService.findAll({
      subject,
      exam,
      q,
      take: take ? Number.parseInt(take, 10) : undefined,
    });
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.learningService.findBySlug(slug);
  }
}
