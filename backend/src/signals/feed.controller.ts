import { Controller, Get, Query, Res } from '@nestjs/common';
import { SignalsRepository } from './signals.repository';
import RSS from 'rss';
import striptags from 'striptags';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';

@Controller('api')
export class FeedController {
  constructor(private readonly signalsRepository: SignalsRepository) {}

  @Get('feed.xml')
  async getFeed(
    @Query('category') category: string,
    @Query('severity') severity: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Res() res: Response,
  ) {
    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10)));

      const { data: signals } = await this.signalsRepository.findAll({
        page: pageNum,
        limit: limitNum,
        severity,
        categoryId: category,
        sort: 'score',
        order: 'desc',
      });

      const filteredSignals = signals.filter((signal) => signal.score >= 5);

      const feed = new RSS({
        title: 'SignalStack Intelligence Feed',
        description: 'Curated intelligence signals from SignalStack',
        feed_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/feed.xml`,
        site_url: process.env.FRONTEND_URL || 'http://localhost:3000',
        language: 'en',
        ttl: 15,
      });

      filteredSignals.forEach((signal) => {
        const description = signal.aiSummary
          ? striptags(signal.aiSummary)
          : signal.content
            ? striptags(signal.content.slice(0, 300))
            : '';

        feed.item({
          title: signal.title,
          description,
          url: signal.url,
          guid: signal.id,
          date: signal.publishedAt ? new Date(signal.publishedAt) : new Date(),
          categories: [signal.categoryId, signal.severity].filter(Boolean),
          custom_elements: [
            { 'signal:score': signal.score },
            { 'signal:source': signal.source },
          ],
        });
      });

      const xml = feed.xml({ indent: true });

      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=900');

      return res.send(xml);
    } catch {
      throw new ServiceUnavailableException('Unable to generate feed');
    }
  }
}
