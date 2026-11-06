import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamCategory } from '@prisma/client';

@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  findAll(@Query('category') category?: ExamCategory, @Query('q') search?: string) {
    return this.examsService.findAll(category, search);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.examsService.findBySlug(slug);
  }
}
