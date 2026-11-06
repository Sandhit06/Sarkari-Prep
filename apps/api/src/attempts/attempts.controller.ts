import { Controller, Post, Patch, Get, Param, Body } from '@nestjs/common';
import { AttemptsService, ResponsePayload } from './attempts.service';
import { ProctorEventType } from '@prisma/client';

@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post('start')
  startAttempt(@Body() body: { userId?: string; paperId: string }) {
    return this.attemptsService.startAttempt(body.userId, body.paperId);
  }

  @Get(':id')
  getAttempt(@Param('id') attemptId: string) {
    return this.attemptsService.getAttempt(attemptId);
  }

  @Patch(':id/response')
  autosaveResponse(@Param('id') attemptId: string, @Body() body: ResponsePayload) {
    return this.attemptsService.autosaveResponse(attemptId, body);
  }

  @Post(':id/proctor-event')
  logProctorEvent(
    @Param('id') attemptId: string,
    @Body() body: { type: ProctorEventType; details?: string },
  ) {
    return this.attemptsService.logProctorEvent(attemptId, body.type, body.details);
  }

  @Post(':id/submit')
  submitAttempt(
    @Param('id') attemptId: string,
    @Body() body: { responses?: ResponsePayload[] },
  ) {
    return this.attemptsService.submitAndGradeAttempt(attemptId, body?.responses);
  }
}
