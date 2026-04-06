import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { logEvent } from '../../common/logger';

@Injectable()
export class OpenRouterProvider {
  private readonly apiKey: string | undefined;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly model = 'meta-llama/llama-3.1-405b-instruct';

  public lastError: number | null = null;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
  }

  async summarize(title: string, content: string): Promise<string | null> {
    this.lastError = null;
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        {
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
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://signalstack.now',
            'X-Title': 'SignalStack',
          },
          timeout: 5000,
        }
      );

      const result = response.data?.choices?.[0]?.message?.content?.trim();
      return result ? this.cleanResponse(result) : null;
    } catch (error: any) {
      this.lastError = error.response?.status || 500;
      logEvent('warn', 'openrouter_provider_error', { 
        status: error.response?.status, 
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
      await axios.post(
        this.apiUrl,
        { model: this.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 },
        { headers: { Authorization: `Bearer ${this.apiKey}`, 'HTTP-Referer': 'https://signalstack.now', 'X-Title': 'SignalStack' }, timeout: 5000 }
      );
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}
