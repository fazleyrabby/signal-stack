import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { logEvent } from '../../common/logger';

@Injectable()
export class LocalProvider {
  private readonly timeout = 8000;
  private readonly maxTokens = 30;

  public lastError: number | null = null;
  private enabled: boolean;
  private baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('LOCAL_AI_ENABLED') === 'true';
    this.baseUrl = this.configService.get<string>('LOCAL_AI_URL') || 'http://llama:8080';
  }

  async summarize(title: string, content: string): Promise<string | null> {
    this.lastError = null;

    if (!this.enabled) {
      return null;
    }

    try {
      const prompt = this.buildPrompt(title, content);

      const response = await axios.post(
        `${this.baseUrl}/completion`,
        {
          prompt,
          n_predict: this.maxTokens,
          temperature: 0.2,
          cache_prompt: true,
        },
        {
          timeout: this.timeout,
        }
      );

      const result = response.data?.content?.trim();
      return result ? this.cleanResponse(result) : null;
    } catch (error: any) {
      this.lastError = error.response?.status || 500;
      logEvent('warn', 'local_provider_error', {
        status: this.lastError,
        message: error.message,
      });
      return null;
    }
  }

  async checkHealth(): Promise<{ status: string; latency?: number; error?: string }> {
    if (!this.enabled) {
      return { status: 'disabled' };
    }

    const start = Date.now();
    try {
      await axios.post(
        `${this.baseUrl}/completion`,
        { prompt: 'Hi', n_predict: 1 },
        { timeout: 5000 }
      );
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  private buildPrompt(title: string, content: string): string {
    const trimmedContent = content.slice(0, 200);
    return `Q: Summarize this in one short sentence:\nTitle: ${title}\nContent: ${trimmedContent}\nA:`;
  }

  private cleanResponse(text: string): string {
    const cleaned = text
      .replace(/<\|.*?\|>/g, ' ')
      .replace(/<.*?>/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const words = cleaned.split(' ').slice(0, 15).join(' ');
    return words.slice(0, 100);
  }
}
