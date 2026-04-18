import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { AdminGuard } from './admin.guard';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('api/admin')
@UseGuards(AdminGuard)
@SkipThrottle()
export class LogsController {
  private logPath = join(process.cwd(), 'logs/app.log');

  @Get('logs')
  async getLogs(@Query('limit') limit = '200', @Res() res: Response) {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const parsed = lines
        .slice(-Number(limit))
        .map((line) => {
          try { return JSON.parse(line); }
          catch { return { ts: new Date().toISOString(), level: 'info', context: 'app', message: line }; }
        })
        .reverse(); // newest first
      res.json({ logs: parsed, total: lines.length });
    } catch {
      res.json({ logs: [], total: 0 });
    }
  }
}
