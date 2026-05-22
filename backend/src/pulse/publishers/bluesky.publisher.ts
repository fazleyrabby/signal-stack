import { Injectable, Logger } from '@nestjs/common';
import { IPublisher, PublishResult } from './publisher.interface';
import { PulseEncryptionService } from '../services/pulse-encryption.service';
import { PlatformLimitsService } from '../services/platform-limits.service';

const BSKY_PDS = 'https://bsky.social';

@Injectable()
export class BlueskyPublisher implements IPublisher {
  readonly platform = 'bluesky';
  private readonly logger = new Logger(BlueskyPublisher.name);

  constructor(
    private readonly encryption: PulseEncryptionService,
    private readonly platformLimits: PlatformLimitsService,
  ) {}

  /**
   * Publishes a text post to Bluesky via AT Protocol.
   *
   * Credential mapping (stored in pulse_accounts):
   *   - apiKey       → Bluesky handle (e.g. user.bsky.social)
   *   - accessToken  → App Password
   *   - apiSecret    → not used
   *   - accessTokenSecret → not used
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
      const daily = await this.platformLimits.checkAndIncrement('bluesky', 'daily');
      if (!daily.allowed) {
        return {
          success: false,
          error: `Bluesky daily publishing limit reached (${daily.current - 1}/${daily.limit} posts today)`,
        };
      }

      const hourly = await this.platformLimits.checkAndIncrement('bluesky', 'hourly');
      if (!hourly.allowed) {
        return {
          success: false,
          error: `Bluesky hourly publishing limit reached (${hourly.current - 1}/${hourly.limit} posts this hour)`,
        };
      }

      const identifier = this.encryption.decrypt(credentials.apiKey);
      const appPassword = this.encryption.decrypt(credentials.accessToken);

      // 1. Create session
      const sessionRes = await fetch(`${BSKY_PDS}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: appPassword }),
      });

      if (!sessionRes.ok) {
        const err = await sessionRes.json() as any;
        return { success: false, error: err?.message || `Session creation failed: HTTP ${sessionRes.status}` };
      }

      const session = await sessionRes.json() as { accessJwt: string; did: string };

      // 2. Create post record
      const postRes = await fetch(`${BSKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text,
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (!postRes.ok) {
        const err = await postRes.json() as any;
        const msg = err?.message || `HTTP ${postRes.status}`;
        this.logger.error(`Bluesky post error: ${msg}`);
        return { success: false, error: msg };
      }

      const post = await postRes.json() as { uri: string; cid: string };
      return { success: true, postId: post.uri };
    } catch (err: any) {
      this.logger.error(`Error publishing to Bluesky: ${err.message}`);
      return { success: false, error: err.message || 'Unknown error during Bluesky publication' };
    }
  }

  async verifyCredentials(credentials: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  }): Promise<boolean> {
    try {
      const identifier = this.encryption.decrypt(credentials.apiKey);
      const appPassword = this.encryption.decrypt(credentials.accessToken);

      const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: appPassword }),
      });

      return res.ok;
    } catch (err: any) {
      this.logger.warn(`Bluesky credentials verification failed: ${err.message}`);
      return false;
    }
  }
}
