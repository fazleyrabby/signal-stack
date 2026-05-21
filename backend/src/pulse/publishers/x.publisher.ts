import { Injectable, Logger } from '@nestjs/common';
import { IPublisher, PublishResult } from './publisher.interface';
import { PulseEncryptionService } from '../services/pulse-encryption.service';
import { PlatformLimitsService } from '../services/platform-limits.service';
import { TwitterApi } from 'twitter-api-v2';

@Injectable()
export class XPublisher implements IPublisher {
  readonly platform = 'x';
  private readonly logger = new Logger(XPublisher.name);

  constructor(
    private readonly encryption: PulseEncryptionService,
    private readonly platformLimits: PlatformLimitsService,
  ) {}

  /** Convenience passthrough so DraftsController can encrypt before saving. */
  encrypt(text: string): string {
    return this.encryption.encrypt(text);
  }

  /** Convenience passthrough for credential verification in controller. */
  decrypt(cipherHex: string): string {
    return this.encryption.decrypt(cipherHex);
  }

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
      // 1. Enforce daily limit
      const daily = await this.platformLimits.checkAndIncrement('x', 'daily');
      if (!daily.allowed) {
        return {
          success: false,
          error: `X daily publishing limit reached (${daily.current - 1}/${daily.limit} posts today)`,
        };
      }

      // 2. Enforce hourly limit (advisory — decrement daily if hourly blocked)
      const hourly = await this.platformLimits.checkAndIncrement('x', 'hourly');
      if (!hourly.allowed) {
        return {
          success: false,
          error: `X hourly publishing limit reached (${hourly.current - 1}/${hourly.limit} posts this hour)`,
        };
      }

      // 3. Decrypt credentials
      const apiKey = this.encryption.decrypt(credentials.apiKey);
      const apiSecret = this.encryption.decrypt(credentials.apiSecret);
      const accessToken = this.encryption.decrypt(credentials.accessToken);
      const accessTokenSecret = this.encryption.decrypt(credentials.accessTokenSecret);

      // 4. Initialize Twitter client and post
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken,
        accessSecret: accessTokenSecret,
      });

      const res = await client.readWrite.v2.tweet(text);

      if (res?.data?.id) {
        return { success: true, postId: res.data.id };
      }

      return {
        success: false,
        error: 'Failed to retrieve post ID from X response',
      };
    } catch (err: any) {
      this.logger.error(`Error publishing to X: ${err.message}`);
      return {
        success: false,
        error: err.message || 'Unknown error occurred during X publication',
      };
    }
  }

  async verifyCredentials(credentials: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  }): Promise<boolean> {
    try {
      const client = new TwitterApi({
        appKey: this.encryption.decrypt(credentials.apiKey),
        appSecret: this.encryption.decrypt(credentials.apiSecret),
        accessToken: this.encryption.decrypt(credentials.accessToken),
        accessSecret: this.encryption.decrypt(credentials.accessTokenSecret),
      });
      const me = await client.v2.me();
      return !!me?.data?.id;
    } catch (err: any) {
      this.logger.warn(`Credentials verification failed: ${err.message}`);
      return false;
    }
  }
}
