import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logEvent } from '../common/logger';

@Injectable()
export class PicoClawService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly enabled: boolean;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_LIMIT = 3;
  private readonly CIRCUIT_BREAKER_RESET_MS = 60000;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('PICOCLAW_URL', 'http://192.168.0.213:9000');
    this.timeout = this.configService.get<number>('PICOCLAW_TIMEOUT', 3000);
    this.enabled = this.configService.get<boolean>('PICOCLAW_ENABLED', true);
  }

  async process(signal: string, score: number): Promise<{ result: any; provider: string } | null> {
    if (!this.enabled || this.isCircuitOpen()) {
      return null;
    }

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal, score }),
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`PicoClaw error: ${response.statusText}`);
      }

      const data = await response.json();
      this.failureCount = 0; // Reset on success
      
      logEvent('info', 'picoclaw_success', { provider: data.provider });
      return data;
    } catch (error) {
      this.handleFailure();
      logEvent('error', 'picoclaw_failed', { 
        error: error.name === 'AbortError' ? 'timeout' : error.message 
      });
      return null;
    }
  }

  private isCircuitOpen(): boolean {
    if (this.failureCount >= this.CIRCUIT_BREAKER_LIMIT) {
      if (Date.now() - this.lastFailureTime > this.CIRCUIT_BREAKER_RESET_MS) {
        this.failureCount = 0; // Soft reset
        return false;
      }
      return true;
    }
    return false;
  }

  private handleFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }
}
