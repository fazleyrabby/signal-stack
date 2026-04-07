import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';
import { logEvent } from '../../common/logger';

@Injectable()
export class OpenRouterProvider {
  private readonly apiKey: string | undefined;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly model = 'meta-llama/llama-3.3-70b-instruct';

  public lastError: number | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
  }

  async summarize(title: string, content: string): Promise<string | null> {
    this.lastError = null;
    if (!this.apiKey) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://signalstack.now',
          'X-Title': 'SignalStack',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Summarize why this matters in one sentence. max 30 words, no fluff, no repetition, plain English.',
            },
            {
              role: 'user',
              content: `Title: ${title}\n\nContent: ${content}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 150,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        this.lastError = res.status;
        return null;
      }

      const data = await res.json();

      // Track token usage
      const usage = data?.usage;
      if (usage) {
        await this.redisService.trackTokens('openrouter', usage.prompt_tokens || 0, usage.completion_tokens || 0);
      }

      const result = data?.choices?.[0]?.message?.content?.trim();
      return result ? this.cleanResponse(result) : null;
    } catch (error: any) {
      this.lastError = error.name === 'AbortError' ? 408 : 500;
      logEvent('warn', 'openrouter_provider_error', { 
        status: this.lastError, 
        message: error.message 
      });
      return null;
    }
  }

  private cleanResponse(text: string): string {
    return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  async checkHealth(): Promise<{ status: string; latency?: number; error?: string }> {
    if (!this.apiKey) {
      return { status: 'no_api_key' };
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://signalstack.now',
          'X-Title': 'SignalStack'
        },
        body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}
