import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import { VisitorsService } from './visitors.service';
import type { Request } from 'express';

@Controller('api/visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Post()
  async track(@Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      (req as any).ip ||
      'unknown';
    const userAgent = req.headers['user-agent'] as string | null;
    const sessionId = `session_${ip}`;
    await this.visitorsService.track(ip, userAgent, sessionId);
    return { success: true };
  }

  @Get('stats')
  async getStats() {
    return this.visitorsService.getStats();
  }

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    return this.visitorsService.getVisitors(p, Math.min(l, 100));
  }
}
