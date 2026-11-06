import { Module } from '@nestjs/common';
import { ParserBridgeController } from './parser.controller';
import { ParserBridgeService } from './parser.service';

@Module({
  controllers: [ParserBridgeController],
  providers: [ParserBridgeService],
  exports: [ParserBridgeService],
})
export class ParserBridgeModule {}
