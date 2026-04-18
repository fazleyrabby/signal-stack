import { Injectable } from '@nestjs/common';
import Parser from 'rss-parser';
import pLimit from 'p-limit';
import striptags from 'striptags';
import { RawJob } from '../common/types';
import { logEvent } from '../common/logger';
import { sources } from '../database/schema';

const FEED_TIMEOUT = 10_000;
const CONCURRENCY_LIMIT = 5;

// Companies to exclude — banks, insurance, finance, non-tech
const EXCLUDE_COMPANY = /\b(bank|banking|banque|credit union|mortgage|loan|insurance|insurer|assurance|brokerage|broker|hedge fund|asset management|investment fund|private equity|wealth management|financial services|finserv|lending|leasing|realty|real estate|property management|hospital|clinic|pharmacy|pharma|construction|garments|textile|apparel|airline|telecom carrier)\b/i;

// Job titles to exclude — non-tech banking/finance roles
const EXCLUDE_TITLE = /\b(loan officer|loan originator|mortgage advisor|teller|branch manager|financial advisor|wealth advisor|investment advisor|insurance agent|insurance broker|underwriter|actuary|compliance officer|risk officer|credit analyst|portfolio manager|relationship manager|forex trader|equity trader|claims adjuster|bank teller|financial planner)\b/i;

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html: string): string {
  const decoded = decodeEntities(html);
  const sanitized = decoded
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s>][\s\S]*?<\/style>/gi, '');
  return striptags(sanitized).replace(/\n{3,}/g, '\n\n').trim();
}

@Injectable()
export class JobsFeedService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      timeout: FEED_TIMEOUT,
      headers: {
        'User-Agent': 'SignalStack/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
  }

  async fetchJobs(jobSources: (typeof sources.$inferSelect)[]): Promise<RawJob[]> {
    const limit = pLimit(CONCURRENCY_LIMIT);
    const allJobs: RawJob[] = [];

    const results = await Promise.allSettled(
      jobSources.map((source) => limit(() => this.fetchSingleSource(source)))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value);
      }
    }

    return allJobs;
  }

  private async fetchSingleSource(source: typeof sources.$inferSelect): Promise<RawJob[]> {
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
      const jobs: RawJob[] = [];

      for (const item of feed.items || []) {
        const normalized = this.normalizeItem(item, source);
        if (normalized) jobs.push(normalized);
      }

      return jobs;
    } catch (error) {
      logEvent('warn', 'jobs_fetch_error', {
        source: source.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private normalizeItem(item: Parser.Item, source: typeof sources.$inferSelect): RawJob | null {
    const title = item.title?.trim();
    const url = item.link?.trim();

    if (!title || !url) return null;

    // Exclude non-tech companies and banking/finance job titles
    const company = (item as any).company || (item as any).author || source.name;
    if (EXCLUDE_COMPANY.test(company)) return null;
    if (EXCLUDE_TITLE.test(title)) return null;

    const description = item.content || item.contentSnippet || (item as any).summary || null;
    const cleanDescription = description ? stripHtml(description) : null;

    const dateStr = item.pubDate || item.isoDate || (item as any).published || null;
    let publishedAt: Date | null = null;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) publishedAt = parsed;
    }

    // Stale threshold: 14 days for jobs
    const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;
    if (publishedAt && Date.now() - publishedAt.getTime() > STALE_THRESHOLD_MS) {
      return null;
    }

    // Heuristic for remote
    const isRemote = 
        title.toLowerCase().includes('remote') || 
        cleanDescription?.toLowerCase().includes('remote') ||
        (item as any).categories?.some((c: string) => c.toLowerCase().includes('remote')) ||
        false;

    return {
      source: source.name,
      sourceId: source.id,
      title: decodeEntities(title),
      company: (item as any).company || (item as any).author || source.name,
      location: (item as any).location || null,
      remote: isRemote,
      jobType: (item as any).jobType || null,
      salaryRange: (item as any).salary || null,
      experienceLevel: null,
      description: cleanDescription ? cleanDescription.slice(0, 5000) : null,
      url,
      publishedAt,
      tags: item.categories || [],
    };
  }
}
