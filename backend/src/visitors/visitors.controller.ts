import { Controller, Get, Post, Req } from '@nestjs/common';
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
}
