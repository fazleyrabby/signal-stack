import { Inject, Injectable } from '@nestjs/common';
import Parser from 'rss-parser';
import pLimit from 'p-limit';
import striptags from 'striptags';
import { eq } from 'drizzle-orm';
import { RawSignal, ScoredSignal } from '../common/types';
import { ScorerService } from '../scorer/scorer.service';
import { logEvent } from '../common/logger';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { sources } from '../database/schema';

const FEED_TIMEOUT = 10_000; // 10s per feed

/** Strip HTML tags and decode common entities to plain text */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html: string): string {
  // Decode entities first so encoded tags like &lt;p&gt; become <p> and can be stripped
  const decoded = decodeEntities(html);
  // Remove script/style tags and their content before stripping other tags
  const sanitized = decoded
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s>][\s\S]*?<\/style>/gi, '');
  return striptags(sanitized)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FEED_TIMEOUT);

      const res = await fetch(source.url, {
        headers: {
          'User-Agent': 'SignalStack/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const feed = await this.parser.parseString(text);
      const signals: ScoredSignal[] = [];

      for (const item of feed.items || []) {
        const raw = this.normalizeItem(item, source);
        if (!raw) continue;

        const scored = await this.scorerService.score(raw, source);
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
    const rawContent: string | null =
      (item as any)['content:encoded'] ||
      item.content ||
      (item as any).description ||
      item.contentSnippet ||
      (item as any).summary ||
      null;

    const content = rawContent ? stripHtml(rawContent) : null;

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

    const STALE_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
    if (publishedAt && Date.now() - publishedAt.getTime() > STALE_THRESHOLD_MS) {
      return null; // Skip stale data
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

  async checkSourceHealth(id: string) {
    const source = await this.db.select().from(sources).where(eq(sources.id, id)).limit(1);
    if (!source.length) {
      return { status: 'error', message: 'Source not found' };
    }

    const feed = source[0];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(feed.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SignalStack/1.0' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { status: 'error', code: response.status, message: `HTTP ${response.status}` };
      }

      const contentType = response.headers.get('content-type') || '';
      const isRss = contentType.includes('xml') || contentType.includes('rss');
      const text = await response.text();
      const hasItems = text.includes('<item') || text.includes('<entry');

      return {
        status: 'healthy',
        code: response.status,
        isRss,
        hasData: hasItems,
        itemCount: hasItems ? (text.match(/<item/g) || text.match(/<entry/g))?.length || 0 : 0,
      };
    } catch (error: any) {
      return { status: 'error', message: error.message };
    }
  }

  async toggleSource(id: string) {
    const source = await this.db.select().from(sources).where(eq(sources.id, id)).limit(1);
    if (!source.length) {
      return { success: false, message: 'Source not found' };
    }

    const feed = source[0];
    await this.db.update(sources).set({ isActive: !feed.isActive }).where(eq(sources.id, id));

    return { success: true, isActive: !feed.isActive };
  }
}
