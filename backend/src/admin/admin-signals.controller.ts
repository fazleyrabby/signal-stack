import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { TranslationQueue } from '../ai/translation.queue';
import { TranslationPriority } from '../ai/translation.constants';

@Controller('api/admin/signals')
@UseGuards(AdminGuard)
@SkipThrottle()
export class AdminSignalsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly translationQueue: TranslationQueue,
  ) {}

  @Get()
  async listSignals(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('severity') severity?: string,
    @Query('source') source?: string,
    @Query('categoryId') categoryId?: string,
    @Query('since') since?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('minScore') minScore?: string,
    @Query('hasTranslation') hasTranslation?: string,
    @Query('lang') lang?: string,
  ) {
    const hasTranslationBool =
      hasTranslation === 'true' ? true :
      hasTranslation === 'false' ? false :
      undefined;

    return this.adminService.listSignals({
      page: parseInt(page) || 1,
      limit: Math.min(100, parseInt(limit) || 20),
      severity,
      source,
      categoryId,
      since: since ? new Date(since) : undefined,
      search,
      sort,
      order: order === 'asc' ? 'asc' : 'desc',
      minScore: minScore !== undefined ? parseInt(minScore) : undefined,
      hasTranslation: hasTranslationBool,
      translationLang: lang,
    });
  }

  @Get(':id')
  async getSignal(@Param('id') id: string) {
    const signal = await this.adminService.getSignalById(id);
    if (!signal) throw new NotFoundException('Signal not found');
    return signal;
  }

  @Patch(':id')
  async updateSignal(@Param('id') id: string, @Body() body: Record<string, any>) {
    const allowed = ['title', 'content', 'summary', 'severity', 'score', 'categoryId', 'countryCode', 'aiSummary', 'isRead'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }
    const updated = await this.adminService.updateSignal(id, update);
    if (!updated) throw new NotFoundException('Signal not found');
    return updated;
  }

  @Delete(':id')
  async deleteSignal(@Param('id') id: string) {
    await this.adminService.deleteSignal(id);
    return { deleted: true, id };
  }

  @Post('mark-all-read')
  async markAllRead() {
    const count = await this.adminService.markAllSignalsRead();
    return { marked: count };
  }

  @Post(':id/translate')
  async forceTranslate(
    @Param('id') id: string,
    @Query('lang') lang?: string,
  ) {
    if (!lang) throw new BadRequestException('lang query param required');

    const signal = await this.adminService.getSignalById(id);
    if (!signal) throw new NotFoundException('Signal not found');
    if (!signal.aiSummary) throw new BadRequestException('Signal has no AI summary to translate');

    await this.translationQueue.enqueue(
      { id, title: signal.title, summary: signal.aiSummary, lang },
      'HIGH' as TranslationPriority,
    );

    return { queued: true, lang, signalId: id, priority: 'HIGH' };
  }

  @Post('translate/bulk')
  async bulkTranslate(
    @Body() body: {
      lang: string;
      signalIds?: string[];
      filter?: {
        severity?: string;
        minScore?: number;
        since?: string;
        categoryId?: string;
      };
    },
  ) {
    if (!body.lang) throw new BadRequestException('lang is required');

    const results = await this.adminService.bulkEnqueueTranslations(
      body.lang,
      body.signalIds,
      body.filter,
    );

    return { queued: results, lang: body.lang };
  }

  @Get('export/csv')
  async exportCsv(
    @Query('days') days = '30',
    @Res() res: Response,
  ) {
    const daysNum = parseInt(days) || 30;
    const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
    
    const csvData = await this.adminService.exportSignalsCsv(since);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=signals-export-${days}days.csv`);
    res.send(csvData);
  }
}
