import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { IngestionService } from './ingestion.service';

const DEFAULT_INTERVAL_MS = 5 * 60_000;

@Injectable()
export class IngestionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly ingestion: IngestionService) {}

  onModuleInit() {
    if (process.env.INGESTION_SCHEDULER_ENABLED !== 'true') return;

    const configured = Number(process.env.INGESTION_SCHEDULER_INTERVAL_MS);
    const interval = Number.isFinite(configured) && configured >= 30_000
      ? configured
      : DEFAULT_INTERVAL_MS;

    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
    this.timer.unref();
    this.logger.log(`Ingestion scheduler enabled with a ${interval}ms interval.`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const result = await this.ingestion.runDueSources();
      if (result.ran > 0) {
        this.logger.log(`Scheduled ingestion ran ${result.ran} of ${result.checked} due source(s).`);
      }
    } catch (error) {
      this.logger.warn(`Scheduled ingestion tick failed: ${(error as Error).message}`);
    }
  }
}
