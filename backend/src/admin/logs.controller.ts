import {
  Controller,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { promises as fs } from 'fs';
import { join } from 'path';

@Controller('api/admin')
export class LogsController {
  private logPath = join(process.cwd(), 'logs/app.log');

  @Get('logs')
  async getLogs(@Res() res: Response) {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      const lines = content.split('\n').slice(-200);
      res.json({ logs: lines.join('\n') });
    } catch {
      res.json({ logs: 'No logs available' });
    }
  }
}