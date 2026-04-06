import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ScoredSignal } from '../common/types';
import { logEvent } from '../common/logger';

const MIN_INTERVAL_MS = 2000; // 2 seconds between webhook calls

@Injectable()
export class DiscordService {
  private webhookUrl: string | undefined;
  private queue: ScoredSignal[] = [];
  private processing = false;
  private filterTechOnly: boolean;

  constructor(private readonly configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
    this.filterTechOnly = this.configService.get<string>('DISCORD_FILTER_TECH') === 'true';
  }

  /**
   * Queue an alert for sending. Rate-limited to 1 per 2 seconds.
   */
  async sendAlert(signal: ScoredSignal): Promise<void> {
    if (!this.webhookUrl) {
      logEvent('warn', 'alert_skipped', { reason: 'No DISCORD_WEBHOOK_URL configured' });
      return;
    }

    if (this.filterTechOnly && signal.aiCategory !== 'Tech') {
      logEvent('info', 'alert_skipped', { reason: 'non_tech', aiCategory: signal.aiCategory, title: signal.title.slice(0, 50) });
      return;
    }

    this.queue.push(signal);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const signal = this.queue.shift()!;

      try {
        const color =
          signal.severity === 'high' ? 0xff0000
          : signal.severity === 'medium' ? 0xffa500
          : 0x00ff00;

        await axios.post(this.webhookUrl!, {
          embeds: [
            {
              title: signal.title.slice(0, 256),
              url: signal.url,
              description: signal.content?.slice(0, 200) || '',
              color,
              fields: [
                { name: 'Source', value: signal.source, inline: true },
                { name: 'Score', value: String(signal.score), inline: true },
                {
                  name: 'Severity',
                  value: signal.severity.toUpperCase(),
                  inline: true,
                },
              ],
              timestamp:
                signal.publishedAt?.toISOString() || new Date().toISOString(),
              footer: { text: 'SignalStack' },
            },
          ],
        });

        logEvent('info', 'alert_sent', {
          source: signal.source,
          title: signal.title.slice(0, 80),
        });
      } catch (error) {
        logEvent('error', 'alert_failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          title: signal.title.slice(0, 80),
        });
      }

      // Rate limit: wait 2 seconds between calls
      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS));
      }
    }

    this.processing = false;
  }
}
