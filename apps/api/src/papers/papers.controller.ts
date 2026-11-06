import { Controller, Get, Param, Query } from '@nestjs/common';
import { PapersService } from './papers.service';

@Controller('papers')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Get()
  findAll(
    @Query('examSlug') examSlug?: string,
    @Query('year') year?: string,
    @Query('isMock') isMock?: string,
  ) {
    return this.papersService.findAll(
      examSlug,
      year ? parseInt(year, 10) : undefined,
      isMock !== undefined ? isMock === 'true' : undefined,
    );
  }

  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.papersService.findPlayablePaperBySlugOrId(idOrSlug);
  }
}
