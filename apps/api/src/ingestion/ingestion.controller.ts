import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  IngestionService,
  ManualIngestInput,
  SourceInput,
} from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Get('health')
  health() {
    return this.ingestion.health();
  }

  @Get('sources')
  listSources() {
    return this.ingestion.listSources();
  }

  @Post('sources')
  createSource(@Body() body: SourceInput) {
    return this.ingestion.createSource(body);
  }

  @Patch('sources/:id')
  updateSource(@Param('id') id: string, @Body() body: Partial<SourceInput>) {
    return this.ingestion.updateSource(id, body);
  }

  @Post('sources/:id/run')
  runSource(@Param('id') id: string, @Body() body: { force?: boolean }) {
    return this.ingestion.runSource(id, { force: body?.force === true });
  }

  @Post('sync')
  sync() {
    return this.ingestion.runDueSources();
  }

  @Get('runs')
  listRuns(@Query('sourceId') sourceId?: string, @Query('take') take?: string) {
    return this.ingestion.listRuns({
      sourceId,
      take: this.parseTake(take),
    });
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.ingestion.getRun(id);
  }

  @Get('knowledge')
  listKnowledge(
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('exam') exam?: string,
    @Query('q') q?: string,
    @Query('take') take?: string,
  ) {
    return this.ingestion.listKnowledge({
      status,
      kind,
      exam,
      q,
      take: this.parseTake(take),
    });
  }

  @Post('knowledge')
  ingestText(@Body() body: ManualIngestInput) {
    return this.ingestion.ingestText(body);
  }

  @Post('knowledge/:id/publish')
  publishKnowledge(@Param('id') id: string) {
    return this.ingestion.publishKnowledge(id);
  }

  @Post('knowledge/:id/reject')
  rejectKnowledge(@Param('id') id: string) {
    return this.ingestion.rejectKnowledge(id);
  }

  private parseTake(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
