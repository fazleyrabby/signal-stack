import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import striptags from 'striptags';
import { ScoredSignal } from '../common/types';
import { logEvent } from '../common/logger';
import { SettingsService } from '../ai/settings.service';

const MIN_INTERVAL_MS = 2000; // 2 seconds between webhook calls

type DiscordAlert = { type: 'signal'; data: ScoredSignal } | { type: 'job'; data: any };

@Injectable()
export class DiscordService implements OnModuleInit {
  private webhookUrl: string | undefined;
  private jobsWebhookUrl: string | undefined;
  private queue: DiscordAlert[] = [];
  private processing = false;
  private filterTechOnly: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {
    this.webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
    this.jobsWebhookUrl = this.configService.get<string>('DISCORD_JOBS_WEBHOOK_URL');
    this.filterTechOnly =
      this.configService.get<string>('DISCORD_FILTER_TECH') === 'true';
  }

  async onModuleInit() {
    // Override env vars with DB-stored values if present
    const storedMain = await this.settingsService.getSetting('discord_webhook_url');
    const storedJobs = await this.settingsService.getSetting('discord_jobs_webhook_url');
    if (storedMain) this.webhookUrl = storedMain;
    if (storedJobs) this.jobsWebhookUrl = storedJobs;
  }

  updateWebhookUrls(main?: string, jobs?: string) {
    if (main !== undefined) this.webhookUrl = main || undefined;
    if (jobs !== undefined) this.jobsWebhookUrl = jobs || undefined;
  }

  getWebhookUrls() {
    return {
      webhookUrl: this.webhookUrl || '',
      jobsWebhookUrl: this.jobsWebhookUrl || '',
    };
  }

  /**
   * Queue a signal alert.
   */
  async sendAlert(signal: ScoredSignal): Promise<void> {
    if (!this.webhookUrl) return;

    if (this.filterTechOnly && signal.aiCategory !== 'Tech') return;

    this.queue.push({ type: 'signal', data: signal });
    this.processQueue();
  }

  /**
   * Queue a job alert.
   */
  async sendJobAlert(job: any): Promise<void> {
    if (!this.jobsWebhookUrl) return;

    this.queue.push({ type: 'job', data: job });
    this.processQueue();
  }

  /**
   * Alert when AI draft generation is exhausted after all retries.
   */
  async sendPulseFailureAlert(signalId: string, error: string): Promise<void> {
    if (!this.webhookUrl) return;
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '⚠️ Pulse AI Generation Failed',
            description: `AI draft generation exhausted all retries for signal \`${signalId}\`.`,
            color: 0xff4444,
            fields: [
              { name: 'Signal ID', value: signalId, inline: true },
              { name: 'Error', value: error.slice(0, 1000), inline: false },
              { name: 'Action Required', value: 'Open Pulse → Drafts Queue → Failed tab to retry manually.', inline: false },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'SignalStack Pulse' },
          }],
        }),
      });
    } catch (err: any) {
      logEvent('error', 'pulse_discord_alert_failed', { error: err.message });
    }
  }

  /**
   * Alert when a scheduled publish exhausts all retries.
   */
  async sendPublishFailureAlert(draftId: string, platform: string, error: string): Promise<void> {
    if (!this.webhookUrl) return;
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `⚠️ Pulse Publish Failed — ${platform.toUpperCase()}`,
            description: `A scheduled post exhausted all publish retries on **${platform}**.`,
            color: 0xff6600,
            fields: [
              { name: 'Draft ID', value: draftId, inline: true },
              { name: 'Platform', value: platform, inline: true },
              { name: 'Error', value: error.slice(0, 1000), inline: false },
              { name: 'Action Required', value: 'Open Pulse → Drafts Queue → Failed tab to inspect and retry.', inline: false },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'SignalStack Pulse' },
          }],
        }),
      });
    } catch (err: any) {
      logEvent('error', 'pulse_discord_publish_alert_failed', { error: err.message });
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const alert = this.queue.shift()!;
      
      try {
        if (alert.type === 'signal') {
          await this.processSignalAlert(alert.data);
        } else {
          await this.processJobAlert(alert.data);
        }
      } catch (error) {
        logEvent('error', 'alert_failed', {
          type: alert.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS));
      }
    }

    this.processing = false;
  }

  private async processSignalAlert(signal: ScoredSignal) {
    const color =
      signal.severity === 'high'
        ? 0xff0000
        : signal.severity === 'medium'
          ? 0xffa500
          : 0x00ff00;

    const res = await fetch(this.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: signal.title.slice(0, 256),
            url: signal.url,
            description: signal.content ? striptags(signal.content).slice(0, 200) : '',
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
            timestamp: signal.publishedAt?.toISOString() || new Date().toISOString(),
            footer: { text: 'SignalStack' },
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  private async processJobAlert(job: any) {
    const fields = [
      { name: 'Company', value: job.company || 'Unknown', inline: true },
      { name: 'Location', value: job.location || 'Remote', inline: true },
    ];

    if (job.salaryRange) {
      fields.push({ name: 'Salary', value: job.salaryRange, inline: true });
    }

    if (job.jobType) {
      fields.push({ name: 'Type', value: job.jobType, inline: true });
    }

    const res = await fetch(this.jobsWebhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `New Job: ${job.title}`.slice(0, 256),
            url: job.url,
            description: job.description ? striptags(job.description).slice(0, 300) : '',
            color: 0x0077b5, // LinkedIn Blue
            fields,
            timestamp: job.publishedAt ? new Date(job.publishedAt).toISOString() : new Date().toISOString(),
            footer: { text: 'SignalStack Jobs' },
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
}
