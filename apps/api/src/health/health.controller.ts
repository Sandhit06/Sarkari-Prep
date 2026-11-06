import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParserBridgeService } from '../parser-bridge/parser.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ParserBridgeService,
  ) {}

  @Get()
  async check() {
    const startedAt = Date.now();
    let database: 'up' | 'down' = 'down';
    let databaseLatencyMs: number | null = null;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
      databaseLatencyMs = Date.now() - startedAt;
    } catch {
      database = 'down';
    }

    const parser = await this.parser.getParserHealth();
    const parserOk = parser?.status === 'ok';
    const status = database === 'up' && parserOk ? 'ok' : 'degraded';

    return {
      status,
      service: 'sarkariprep-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database: { status: database, latencyMs: databaseLatencyMs },
      parser,
    };
  }
}
