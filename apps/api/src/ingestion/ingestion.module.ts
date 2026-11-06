import { Module } from '@nestjs/common';
import { IngestionAiService } from './ingestion-ai.service';
import { IngestionController } from './ingestion.controller';
import { IngestionScheduler } from './ingestion.scheduler';
import { IngestionService } from './ingestion.service';

@Module({
  controllers: [IngestionController],
  providers: [IngestionAiService, IngestionService, IngestionScheduler],
  exports: [IngestionService],
})
export class IngestionModule {}
