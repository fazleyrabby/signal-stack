import { Injectable } from '@nestjs/common';
import { SignalsRepository } from './signals.repository';
import { ScoredSignal } from '../common/types';
import { logEvent } from '../common/logger';
import { AIQueue } from '../ai/ai.queue';

@Injectable()
export class SignalsService {
  constructor(
    private readonly repository: SignalsRepository,
    private readonly aiQueue: AIQueue,
  ) {}

  /**
   * Insert a scored signal. Returns true if inserted, false if duplicate.
   */
  async insertSignal(signal: ScoredSignal): Promise<boolean> {
    // Check for existing hash first
    const exists = await this.repository.hashExists(signal.hash);
    if (exists) {
      return false;
    }

    const inserted = await this.repository.insert({
      source: signal.source,
      categoryId: signal.categoryId,
      title: signal.title,
      content: signal.content,
      url: signal.url,
      score: signal.score,
      severity: signal.severity,
      summary: signal.summary,
      aiCategory: signal.aiCategory,
      hash: signal.hash,
      publishedAt: signal.publishedAt,
    });

    if (inserted) {
      logEvent('info', 'signal_processed', {
        source: inserted.source,
        score: inserted.score,
        severity: inserted.severity,
        title: inserted.title.slice(0, 80),
      });

      // ⚡ New: Step 2: Trigger AI ONLY for high-importance signals (score >= 7)
      if (inserted.score >= 7) {
        this.aiQueue.enqueue({
          id: inserted.id,
          title: inserted.title,
          content: inserted.content,
        });
      }
    }

    return !!inserted;
  }

  /**
   * Get paginated signals with optional filters
   */
  async getSignals(params: {
    page: number;
    limit: number;
    severity?: string;
    source?: string;
    categoryId?: string;
    since?: string;
    search?: string;
    sort?: string;
    order?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const order = params.order === 'asc' ? 'asc' as const : 'desc' as const;

    let since: Date | undefined;
    if (params.since) {
      const parsed = new Date(params.since);
      if (!isNaN(parsed.getTime())) {
        since = parsed;
      }
    }

    const { data, total } = await this.repository.findAll({
      page,
      limit,
      severity: params.severity,
      source: params.source,
      categoryId: params.categoryId,
      since,
      search: params.search,
      sort: params.sort,
      order,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get signal stats for the dashboard
   */
  async getStats() {
    return this.repository.getStats();
  }
}
