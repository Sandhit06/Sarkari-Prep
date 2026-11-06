import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ParserBridgeModule } from '../parser-bridge/parser.module';

@Module({
  imports: [ParserBridgeModule],
  controllers: [HealthController],
})
export class HealthModule {}
