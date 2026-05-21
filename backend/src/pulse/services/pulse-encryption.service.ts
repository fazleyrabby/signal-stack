import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Owns AES-256-GCM key management for Pulse credential storage.
 * Fails fast if the key is unavailable in production.
 */
@Injectable()
export class PulseEncryptionService {
  private readonly logger = new Logger(PulseEncryptionService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('PULSE_ENCRYPTION_KEY');
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    if (!raw) {
      if (isProd) {
        // Hard fail — never allow production to start without a key.
        throw new InternalServerErrorException(
          'PULSE_ENCRYPTION_KEY is required in production. ' +
          'Set it to a cryptographically random hex string of at least 32 characters.',
        );
      }
      const devKey = 'signalstack-dev-fallback-key-32ch';
      this.logger.warn(
        'PULSE_ENCRYPTION_KEY not set — using insecure development fallback. ' +
        'This MUST NOT be used in production.',
      );
      this.encryptionKey = crypto.createHash('sha256').update(devKey).digest();
      return;
    }

    if (raw.length < 32) {
      const msg =
        `PULSE_ENCRYPTION_KEY is too short (${raw.length} chars). ` +
        'Minimum length is 32 characters.';
      if (isProd) {
        throw new InternalServerErrorException(msg);
      }
      this.logger.warn(msg + ' Proceeding in development mode.');
    }

    this.encryptionKey = crypto.createHash('sha256').update(raw).digest();
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  }

  decrypt(cipherHex: string): string {
    const buf = Buffer.from(cipherHex, 'hex');
    if (buf.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Invalid ciphertext length');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
