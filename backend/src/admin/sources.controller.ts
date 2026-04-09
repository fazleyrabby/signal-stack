import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { FeedService } from '../feed/feed.service';

@Controller('api/admin/sources')
export class AdminSourcesController {
  constructor(private readonly feedService: FeedService) {}

  @Post(':id/health')
  async checkSourceHealth(@Param('id') id: string) {
    return this.feedService.checkSourceHealth(id);
  }

  @Post(':id/toggle')
  async toggleSource(@Param('id') id: string) {
    return this.feedService.toggleSource(id);
  }
}