import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ExamsModule } from './exams/exams.module';
import { PapersModule } from './papers/papers.module';
import { AttemptsModule } from './attempts/attempts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ParserBridgeModule } from './parser-bridge/parser.module';
import { CommunityModule } from './community/community.module';
import { HealthModule } from './health/health.module';
import { LearningModule } from './learning/learning.module';
import { IngestionModule } from './ingestion/ingestion.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    ExamsModule,
    PapersModule,
    AttemptsModule,
    AnalyticsModule,
    ParserBridgeModule,
    CommunityModule,
    LearningModule,
    IngestionModule,
    HealthModule,
  ],
})
export class AppModule {}
