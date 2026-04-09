import { Controller, Get, Query } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { FeedService } from '../feed/feed.service';

@Controller('api')
export class SignalsController {
  private readonly startTime = Date.now();

  constructor(
    private readonly signalsService: SignalsService,
    private readonly feedService: FeedService,
  ) {}

  @Get('signals')
  async getSignals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('severity') severity?: string,
    @Query('source') source?: string,
    @Query('categoryId') categoryId?: string,
    @Query('since') since?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.signalsService.getSignals({
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
      severity,
      source,
      categoryId,
      since,
      search,
      sort,
      order,
    });
  }

  @Get('signals/sources')
  async getSources(@Query('categoryId') categoryId?: string) {
    return this.signalsService.getUniqueSources(categoryId);
  }

  @Get('signals/stats')
  async getStats() {
    return this.signalsService.getStats();
  }

  @Get('signals/ai-providers')
  async getAIProviderStats() {
    return this.signalsService.getAIProviderStats();
  }

  @Get('health')
  async getHealth() {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      lastFetch: this.feedService.lastFetch?.toISOString() || null,
      feedsActive: this.feedService.activeFeedsCount,
    };
  }

  @Get('signals/trends')
  async getTrends() {
    return this.signalsService.getTrends();
  }
}
