import { PulseEncryptionService } from './src/pulse/services/pulse-encryption.service';
import { ConfigService } from '@nestjs/config';

// Mock ConfigService to return the live key
const config = new ConfigService({
  PULSE_ENCRYPTION_KEY: process.env.PULSE_ENCRYPTION_KEY || 'your_encryption_key'
});

const enc = new PulseEncryptionService(config);

const apiKey = enc.encrypt(process.env.FB_API_KEY || '');
const apiSecret = enc.encrypt(process.env.FB_API_SECRET || '');
const accessToken = enc.encrypt(process.env.FB_ACCESS_TOKEN || '');
const accessTokenSecret = enc.encrypt(process.env.FB_ACCESS_TOKEN_SECRET || '');

console.log(`UPDATE "pulseAccounts" SET "apiKey" = '${apiKey}', "apiSecret" = '${apiSecret}', "accessToken" = '${accessToken}', "accessTokenSecret" = '${accessTokenSecret}', "handle" = 'Signal Stack' WHERE platform = 'facebook';`);
