import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../ai/redis.service';
import { IPublisher, PublishResult } from './publisher.interface';
import { TwitterApi } from 'twitter-api-v2';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

@Injectable()
export class XPublisher implements IPublisher {
  private readonly logger = new Logger(XPublisher.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    const rawKey = this.configService.get<string>('PULSE_ENCRYPTION_KEY') || 'dev-secret-key-must-be-32-chars-!';
    this.encryptionKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  }

  decrypt(cipherHex: string): string {
    const cipherBuffer = Buffer.from(cipherHex, 'hex');
    if (cipherBuffer.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Invalid ciphertext length');
    }
    const iv = cipherBuffer.subarray(0, IV_LENGTH);
    const tag = cipherBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encryptedText = cipherBuffer.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString('utf8');
  }

  async publish(text: string, credentials: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  }): Promise<PublishResult> {
    try {
      // 1. Check daily posting rate limit (max 2 posts per day)
      const today = new Date().toISOString().split('T')[0];
      const redisKey = `pulse:x:post_count:${today}`;
      const currentCount = await this.redis.incr(redisKey);

      if (currentCount === 1) {
        await this.redis.expire(redisKey, 86400 + 3600); // 25 hours TTL
      }

      if (currentCount > 2) {
        return {
          success: false,
          error: 'X publishing limit reached (max 2 tweets per day)',
        };
      }

      // 2. Decrypt credentials
      const apiKey = this.decrypt(credentials.apiKey);
      const apiSecret = this.decrypt(credentials.apiSecret);
      const accessToken = this.decrypt(credentials.accessToken);
      const accessTokenSecret = this.decrypt(credentials.accessTokenSecret);

      // 3. Initialize Twitter client
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessTokenSecret,
      });

      // 4. Send tweet
      const res = await client.readWrite.v2.tweet(text);

      if (res && res.data && res.data.id) {
        return {
          success: true,
          postId: res.data.id,
        };
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
      const apiKey = this.decrypt(credentials.apiKey);
      const apiSecret = this.decrypt(credentials.apiSecret);
      const accessToken = this.decrypt(credentials.accessToken);
      const accessTokenSecret = this.decrypt(credentials.accessTokenSecret);

      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessTokenSecret,
      });

      const me = await client.v2.me();
      return !!me?.data?.id;
    } catch (err: any) {
      this.logger.warn(`Credentials verification failed: ${err.message}`);
      return false;
    }
  }
}
