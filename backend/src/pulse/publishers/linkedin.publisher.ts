import { Injectable, Logger } from '@nestjs/common';
import { IPublisher, PublishResult } from './publisher.interface';
import { PulseEncryptionService } from '../services/pulse-encryption.service';
import { PlatformLimitsService } from '../services/platform-limits.service';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

@Injectable()
export class LinkedInPublisher implements IPublisher {
  readonly platform = 'linkedin';
  private readonly logger = new Logger(LinkedInPublisher.name);

  constructor(
    private readonly encryption: PulseEncryptionService,
    private readonly platformLimits: PlatformLimitsService,
  ) {}

  /**
   * Publishes a text post to a LinkedIn Page or personal profile.
   *
   * Credential mapping (stored in pulse_accounts):
   *   - apiKey           → App Client ID
   *   - apiSecret        → App Client Secret
   *   - accessToken      → OAuth 2.0 Access Token
   *   - accessTokenSecret → Person/Organization URN (e.g. urn:li:person:xxx)
   */
  async publish(
    text: string,
    credentials: {
      apiKey: string;
      apiSecret: string;
      accessToken: string;
      accessTokenSecret: string;
    },
  ): Promise<PublishResult> {
    try {
      const daily = await this.platformLimits.checkAndIncrement('linkedin', 'daily');
      if (!daily.allowed) {
        return {
          success: false,
          error: `LinkedIn daily publishing limit reached (${daily.current - 1}/${daily.limit} posts today)`,
        };
      }

      const hourly = await this.platformLimits.checkAndIncrement('linkedin', 'hourly');
      if (!hourly.allowed) {
        return {
          success: false,
          error: `LinkedIn hourly publishing limit reached (${hourly.current - 1}/${hourly.limit} posts this hour)`,
        };
      }

      // For legacy accounts, URN was stored in apiKey. For new accounts it's in accessTokenSecret.
      let authorUrn = '';
      try {
        authorUrn = this.encryption.decrypt(credentials.accessTokenSecret);
      } catch {}
      
      if (!authorUrn || !authorUrn.startsWith('urn:li:')) {
        authorUrn = this.encryption.decrypt(credentials.apiKey); // fallback
      }
      const accessToken = this.encryption.decrypt(credentials.accessToken);

      const body = {
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      const res = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        const postId = res.headers.get('x-restli-id') || res.headers.get('location') || 'unknown';
        return { success: true, postId };
      }

      const data = await res.json() as any;
      const err = data?.message || data?.serviceErrorCode || `HTTP ${res.status}`;
      this.logger.error(`LinkedIn API error: ${err}`);
      return { success: false, error: err };
    } catch (err: any) {
      this.logger.error(`Error publishing to LinkedIn: ${err.message}`);
      return { success: false, error: err.message || 'Unknown error during LinkedIn publication' };
    }
  }

  async verifyCredentials(credentials: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  }): Promise<boolean> {
    try {
      const accessToken = this.encryption.decrypt(credentials.accessToken);
      const res = await fetch(`${LINKEDIN_API_BASE}/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch (err: any) {
      this.logger.warn(`LinkedIn credentials verification failed: ${err.message}`);
      return false;
    }
  }
}
