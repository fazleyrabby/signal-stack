import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FeedService } from '../feed/feed.service';
import { AdminGuard } from './admin.guard';

@Controller('api/admin/sources')
@UseGuards(AdminGuard)
@SkipThrottle()
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
