import { Injectable, Logger } from '@nestjs/common';
import { IPublisher, PublishResult } from './publisher.interface';
import { PulseEncryptionService } from '../services/pulse-encryption.service';
import { PlatformLimitsService } from '../services/platform-limits.service';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

@Injectable()
export class FacebookPublisher implements IPublisher {
  readonly platform = 'facebook';
  private readonly logger = new Logger(FacebookPublisher.name);

  constructor(
    private readonly encryption: PulseEncryptionService,
    private readonly platformLimits: PlatformLimitsService,
  ) {}

  /**
   * Publishes a text post to a Facebook Page.
   *
   * Credential mapping (stored in pulse_accounts):
   *   - apiKey       → Page ID
   *   - accessToken  → Page Access Token (long-lived)
   *   - apiSecret    → App Secret (for future token refresh, optional)
   *   - accessTokenSecret → not used, stored as empty string
   */
  async publish(
    text: string,
    credentials: {
      apiKey: string;       // encrypted Page ID
      apiSecret: string;    // encrypted App Secret (optional)
      accessToken: string;  // encrypted Page Access Token
      accessTokenSecret: string; // unused, kept for schema compat
    },
  ): Promise<PublishResult> {
    try {
      // 1. Enforce daily limit
      const daily = await this.platformLimits.checkAndIncrement('facebook', 'daily');
      if (!daily.allowed) {
        return {
          success: false,
          error: `Facebook daily publishing limit reached (${daily.current - 1}/${daily.limit} posts today)`,
        };
      }

      // 2. Enforce hourly limit
      const hourly = await this.platformLimits.checkAndIncrement('facebook', 'hourly');
      if (!hourly.allowed) {
        return {
          success: false,
          error: `Facebook hourly publishing limit reached (${hourly.current - 1}/${hourly.limit} posts this hour)`,
        };
      }

      // 3. Decrypt credentials
      const pageId = this.encryption.decrypt(credentials.apiKey);
      const pageAccessToken = this.encryption.decrypt(credentials.accessToken);

      // 4. Post to Graph API
      const url = `${GRAPH_API_BASE}/${pageId}/feed`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, access_token: pageAccessToken }),
      });

      const data = await res.json() as any;

      if (!res.ok) {
        const err = data?.error?.message || `HTTP ${res.status}`;
        this.logger.error(`Facebook Graph API error: ${err}`);
        return { success: false, error: err };
      }

      if (data?.id) {
        return { success: true, postId: data.id };
      }

      return { success: false, error: 'No post ID returned from Facebook Graph API' };
    } catch (err: any) {
      this.logger.error(`Error publishing to Facebook: ${err.message}`);
      return {
        success: false,
        error: err.message || 'Unknown error during Facebook publication',
      };
    }
  }

  async verifyCredentials(credentials: {
    apiKey: string;
    accessToken: string;
    apiSecret: string;
    accessTokenSecret: string;
  }): Promise<boolean> {
    try {
      const pageId = this.encryption.decrypt(credentials.apiKey);
      const pageAccessToken = this.encryption.decrypt(credentials.accessToken);

      const url = `${GRAPH_API_BASE}/${pageId}?fields=id,name&access_token=${pageAccessToken}`;
      const res = await fetch(url);
      const data = await res.json() as any;

      if (!res.ok || !data?.id) {
        this.logger.warn(`Facebook credential verification failed: ${data?.error?.message}`);
        return false;
      }

      this.logger.log(`Facebook Page verified: ${data.name} (${data.id})`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Facebook credentials verification failed: ${err.message}`);
      return false;
    }
  }
}
