import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignalsService } from '../signals/signals.service';
import * as nodemailer from 'nodemailer';
import { logEvent } from '../common/logger';
import { ScoredSignal } from '../common/types';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private recipients: string[];
  private enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly signalsService: SignalsService,
  ) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = parseInt(
      this.configService.get<string>('SMTP_PORT') || '587',
      10,
    );
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const recipientsStr =
      this.configService.get<string>('DIGEST_RECIPIENTS') || '';
    this.enabled = this.configService.get<boolean>('DIGEST_ENABLED') || false;

    this.recipients = recipientsStr
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (host && port && user && pass && this.enabled) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
    } else {
      console.warn('Email service not fully configured or disabled');
    }
  }

  async sendDigest(): Promise<void> {
    if (!this.enabled) {
      logEvent('info', 'email_skipped', { reason: 'DIGEST_ENABLED is false' });
      return;
    }

    if (!this.transporter) {
      logEvent('error', 'email_failed', {
        reason: 'Transporter not configured',
      });
      return;
    }

    if (this.recipients.length === 0) {
      logEvent('warn', 'email_skipped', { reason: 'No recipients configured' });
      return;
    }

    try {
      // Get signals from last 24h with score >= 7, ordered by score desc, limit 20
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data: signals } = await this.signalsService.getSignals({
        page: 1,
        limit: 20,
        since: oneDayAgo.toISOString(),
        sort: 'score',
        order: 'desc',
      });

      // Filter for score >= 7 (though the query should already do this)
      const highScoreSignals = signals.filter((signal) => signal.score >= 7);

      // Get stats
      const stats = await this.signalsService.getStats();

      // Build HTML email
      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h1 style="color: #38bdf8; text-align: center; margin-bottom: 30px;">
              SignalStack Daily Digest — ${date}
            </h1>
            
            <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h2 style="color: #38bdf8; margin-top: 0;">Digest Statistics</h2>
              <p style="margin: 10px 0;"><strong>Total Signals:</strong> ${stats.total}</p>
              <p style="margin: 10px 0;"><strong>High Importance:</strong> ${stats.high}</p>
              <p style="margin: 10px 0;"><strong>Medium Importance:</strong> ${stats.medium}</p>
              <p style="margin: 10px 0;"><strong>Low Importance:</strong> ${stats.low}</p>
            </div>
            
            ${
              highScoreSignals.length > 0
                ? `
              <div style="background-color: #1e293b; padding: 20px; border-radius: 8px;">
                <h2 style="color: #38bdf8; margin-top: 0;">Top Signals (Score ≥ 7)</h2>
                ${highScoreSignals
                  .map(
                    (signal) => `
                  <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #334155;">
                    <h3 style="margin: 0 0 10px 0;">
                      <a href="${signal.url}" style="color: #38bdf8; text-decoration: none;">${signal.title}</a>
                    </h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 10px;">
                      <span style="background-color: ${this.getSeverityColor(signal.severity)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                        ${signal.source}
                      </span>
                      <span style="background-color: ${this.getScoreColor(signal.score)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                        Score: ${signal.score}
                      </span>
                      ${signal.publishedAt ? `<span style="color: #94a3b8; font-size: 12px;">${new Date(signal.publishedAt).toLocaleTimeString()}</span>` : ''}
                    </div>
                    ${
                      signal.summary
                        ? `
                      <p style="color: #cbd5e1; margin: 10px 0; line-height: 1.5;">${signal.summary}</p>
                    `
                        : ''
                    }
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `
                : `
              <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="color: #94a3b8;">No high-importance signals (score ≥ 7) in the last 24 hours.</p>
              </div>
            `
            }
            
            <div style="text-align: center; margin-top: 30px; color: #64748b; font-size: 14px;">
              Powered by SignalStack
            </div>
          </div>
        </div>
      `;

      // Send email
      const mailOptions = {
        from: `"SignalStack" <${this.configService.get<string>('SMTP_USER')}>`,
        to: this.recipients.join(', '),
        subject: `SignalStack Daily Digest — ${date}`,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      logEvent('info', 'email_sent', {
        recipients: this.recipients.length,
        signalCount: highScoreSignals.length,
      });
    } catch (error) {
      logEvent('error', 'email_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async sendTestDigest(email: string): Promise<void> {
    if (!this.enabled) {
      logEvent('info', 'email_skipped', { reason: 'DIGEST_ENABLED is false' });
      return;
    }

    if (!this.transporter) {
      logEvent('error', 'email_failed', {
        reason: 'Transporter not configured',
      });
      return;
    }

    try {
      // Get signals from last 24h with score >= 7, ordered by score desc, limit 20
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data: signals } = await this.signalsService.getSignals({
        page: 1,
        limit: 20,
        since: oneDayAgo.toISOString(),
        sort: 'score',
        order: 'desc',
      });

      // Filter for score >= 7
      const highScoreSignals = signals.filter((signal) => signal.score >= 7);

      // Get stats
      const stats = await this.signalsService.getStats();

      // Build HTML email (same as sendDigest)
      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h1 style="color: #38bdf8; text-align: center; margin-bottom: 30px;">
              SignalStack Daily Digest — ${date}
            </h1>
            
            <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h2 style="color: #38bdf8; margin-top: 0;">Digest Statistics</h2>
              <p style="margin: 10px 0;"><strong>Total Signals:</strong> ${stats.total}</p>
              <p style="margin: 10px 0;"><strong>High Importance:</strong> ${stats.high}</p>
              <p style="margin: 10px 0;"><strong>Medium Importance:</strong> ${stats.medium}</p>
              <p style="margin: 10px 0;"><strong>Low Importance:</strong> ${stats.low}</p>
            </div>
            
            ${
              highScoreSignals.length > 0
                ? `
              <div style="background-color: #1e293b; padding: 20px; border-radius: 8px;">
                <h2 style="color: #38bdf8; margin-top: 0;">Top Signals (Score ≥ 7)</h2>
                ${highScoreSignals
                  .map(
                    (signal) => `
                  <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #334155;">
                    <h3 style="margin: 0 0 10px 0;">
                      <a href="${signal.url}" style="color: #38bdf8; text-decoration: none;">${signal.title}</a>
                    </h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 10px;">
                      <span style="background-color: ${this.getSeverityColor(signal.severity)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                        ${signal.source}
                      </span>
                      <span style="background-color: ${this.getScoreColor(signal.score)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                        Score: ${signal.score}
                      </span>
                      ${signal.publishedAt ? `<span style="color: #94a3b8; font-size: 12px;">${new Date(signal.publishedAt).toLocaleTimeString()}</span>` : ''}
                    </div>
                    ${
                      signal.summary
                        ? `
                      <p style="color: #cbd5e1; margin: 10px 0; line-height: 1.5;">${signal.summary}</p>
                    `
                        : ''
                    }
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `
                : `
              <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="color: #94a3b8;">No high-importance signals (score ≥ 7) in the last 24 hours.</p>
              </div>
            `
            }
            
            <div style="text-align: center; margin-top: 30px; color: #64748b; font-size: 14px;">
              Powered by SignalStack
            </div>
          </div>
        </div>
      `;

      // Send email
      const mailOptions = {
        from: `"SignalStack" <${this.configService.get<string>('SMTP_USER')}>`,
        to: email,
        subject: `SignalStack Test Digest — ${date}`,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      logEvent('info', 'email_sent', {
        recipient: email,
        signalCount: highScoreSignals.length,
        test: true,
      });
    } catch (error) {
      logEvent('error', 'email_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recipient: email,
        test: true,
      });
      throw error;
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  }

  private getScoreColor(score: number): string {
    if (score >= 9) return '#ef4444';
    if (score >= 7) return '#f59e0b';
    if (score >= 5) return '#10b981';
    return '#6b7280';
  }
}
