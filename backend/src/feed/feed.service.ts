import { Inject, Injectable } from '@nestjs/common';
import Parser from 'rss-parser';
import axios from 'axios';
import pLimit from 'p-limit';
import { eq } from 'drizzle-orm';
import { RawSignal, ScoredSignal } from '../common/types';
import { ScorerService } from '../scorer/scorer.service';
import { logEvent } from '../common/logger';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { sources } from '../database/schema';

const FEED_TIMEOUT = 10_000; // 10s per feed
const CONCURRENCY_LIMIT = 5;

@Injectable()
export class FeedService {
  private parser: Parser;
  private lastFetchTime: Date | null = null;
  private activeCount = 0;

  constructor(
    private readonly scorerService: ScorerService,
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {
    this.parser = new Parser({
      timeout: FEED_TIMEOUT,
      headers: {
        'User-Agent': 'SignalStack/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
  }

  get lastFetch(): Date | null {
    return this.lastFetchTime;
  }

  get activeFeedsCount(): number {
    return this.activeCount;
  }

  /**
   * Fetch all configured feeds concurrently (max 5 at a time)
   * Returns scored signals from all feeds.
   */
  async fetchAllFeeds(): Promise<ScoredSignal[]> {
    const limit = pLimit(CONCURRENCY_LIMIT);
    const allSignals: ScoredSignal[] = [];

    const activeSources = await this.db.select().from(sources).where(eq(sources.isActive, true));
    this.activeCount = activeSources.length;

    const results = await Promise.allSettled(
      activeSources.map((source) =>
        limit(() => this.fetchSingleFeed(source)),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        allSignals.push(...result.value);
      } else {
        logEvent('error', 'feed_fetch_error', {
          source: activeSources[i].name,
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    this.lastFetchTime = new Date();
    return allSignals;
  }

  /**
   * Fetch a single RSS feed and return scored signals
   */
  private async fetchSingleFeed(source: typeof sources.$inferSelect): Promise<ScoredSignal[]> {
    logEvent('info', 'feed_fetch_start', { source: source.name, url: source.url });

    try {
      // Fetch with timeout
      const response = await axios.get(source.url, {
        timeout: FEED_TIMEOUT,
        headers: {
          'User-Agent': 'SignalStack/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        responseType: 'text',
      });

      const feed = await this.parser.parseString(response.data);
      const signals: ScoredSignal[] = [];

      for (const item of feed.items || []) {
        const raw = this.normalizeItem(item, source);
        if (!raw) continue;

        const scored = this.scorerService.score(raw, source);
        signals.push(scored);
      }

      logEvent('info', 'feed_fetch_complete', {
        source: source.name,
        itemCount: signals.length,
      });

      return signals;
    } catch (error) {
      logEvent('warn', 'feed_fetch_error', {
        source: source.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Normalize an RSS item into the internal RawSignal format.
   * Handles different field names across RSS 2.0 / Atom feeds.
   */
  private normalizeItem(
    item: Parser.Item,
    source: typeof sources.$inferSelect,
  ): RawSignal | null {
    const title = item.title?.trim();
    const url = item.link?.trim();

    if (!title || !url) {
      return null;
    }

    // Content extraction priority: content:encoded > content > description > summary
    const content: string | null =
      (item as any)['content:encoded'] ||
      item.content ||
      (item as any).description ||
      item.contentSnippet ||
      (item as any).summary ||
      null;

    // Date extraction
    const dateStr =
      item.pubDate ||
      (item as any).published ||
      (item as any).updated ||
      item.isoDate ||
      null;

    let publishedAt: Date | null = null;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        publishedAt = parsed;
      }
    }

    return {
      source: source.name,
      categoryId: source.categoryId,
      title,
      content: content ? content.slice(0, 2000) : null, // Limit content size
      url,
      publishedAt,
    };
  }
}
