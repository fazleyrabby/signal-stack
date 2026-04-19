import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';
import { AdminGuard } from './admin.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { Cron } from '@nestjs/schedule';

@Controller('api/admin')
@UseGuards(AdminGuard)
@SkipThrottle()
export class LogsController {
  private logPath = join(process.cwd(), 'logs/app.log');

  @Get('logs')
  async getLogs(
    @Query('limit') limit = '300',
    @Query('search') search = '',
    @Query('days') days = '30',
    @Res() res: Response,
  ) {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      const cutoff = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
      const q = search.toLowerCase();

      const parsed = lines
        .map((line) => {
          try { return JSON.parse(line); }
          catch { return { ts: new Date().toISOString(), level: 'info', context: 'app', message: line }; }
        })
        .filter((log) => new Date(log.ts).getTime() >= cutoff)
        .filter((log) => {
          if (!q) return true;
          const hay = JSON.stringify(log).toLowerCase();
          return hay.includes(q);
        })
        .reverse();

      res.json({ logs: parsed.slice(0, Number(limit)), total: parsed.length });
    } catch {
      res.json({ logs: [], total: 0 });
    }
  }

  // Runs daily at 2 AM — prune lines older than 30 days
  @Cron('0 2 * * *')
  async pruneOldLogs() {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const kept = content
        .trim()
        .split('\n')
        .filter(Boolean)
        .filter((line) => {
          try {
            const { ts } = JSON.parse(line);
            return new Date(ts).getTime() >= cutoff;
          } catch {
            return true;
          }
        });
      await fs.writeFile(this.logPath, kept.join('\n') + '\n', 'utf-8');
    } catch {
      // log file may not exist yet
    }
  }
}
