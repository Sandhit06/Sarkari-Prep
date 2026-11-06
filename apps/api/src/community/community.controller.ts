import { Controller, Get, Post, Body } from '@nestjs/common';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('issues')
  listIssues() {
    return this.communityService.listOpenQuestionIssues();
  }

  @Post('issues')
  reportIssue(
    @Body()
    body: {
      questionId: string;
      reporterId?: string;
      issueType: string;
      suggestedOption?: string;
      comment: string;
    },
  ) {
    return this.communityService.reportQuestionIssue(body);
  }

  @Post('takedown')
  submitTakedown(
    @Body()
    body: {
      paperId: string;
      reporterEmail: string;
      reason: string;
      rightsAttested: boolean;
    },
  ) {
    return this.communityService.createTakedownReport(body);
  }
}
