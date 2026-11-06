import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ManualJobPayload,
  ParserBridgeService,
  PublishPayload,
  UploadedDocument,
  UploadJobPayload,
} from './parser.service';
import { ParsingStatus } from '@prisma/client';

@Controller('parser')
export class ParserBridgeController {
  constructor(private readonly parserService: ParserBridgeService) {}

  @Get('health')
  health() {
    return this.parserService.getParserHealth();
  }

  @Post('jobs')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    }),
  )
  createJob(
    @UploadedFile() file: UploadedDocument,
    @Body() body: UploadJobPayload,
  ) {
    return this.parserService.createUploadJob(file, body);
  }

  @Post('jobs/manual')
  createManualJob(@Body() body: ManualJobPayload) {
    return this.parserService.createManualJob(body);
  }

  @Get('jobs')
  listJobs(
    @Query('status') status?: string,
    @Query('take') take?: string,
  ) {
    return this.parserService.listJobs(status, take ? Number.parseInt(take, 10) : 20);
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.parserService.getJob(jobId);
  }

  @Patch('jobs/:jobId')
  updateJob(
    @Param('jobId') jobId: string,
    @Body()
    body: {
      status?: ParsingStatus;
      title?: string;
      shift?: string;
      examSlug?: string;
      year?: number;
      durationMinutes?: number;
      positiveMarks?: number;
      negativeMarks?: number;
      questions?: PublishPayload['questions'];
    },
  ) {
    return this.parserService.updateJob(jobId, body);
  }

  @Post('jobs/:jobId/publish')
  publishJob(@Param('jobId') jobId: string, @Body() body: PublishPayload) {
    return this.parserService.publishReviewedDraft(jobId, body);
  }
}
