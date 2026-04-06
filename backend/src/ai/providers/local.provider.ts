import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { logEvent } from '../../common/logger';

@Injectable()
export class LocalProvider {
  private readonly timeout = 8000;
  private readonly maxTokens = 80;

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

  private buildPrompt(title: string, content: string): string {
    const trimmedContent = content.slice(0, 500);
    return `Summarize why this matters in one sentence. Max 30 words, no fluff, no repetition, plain English.\n\nTitle: ${title}\nContent: ${trimmedContent}\n\nSummary:`;
  }

  private cleanResponse(text: string): string {
    let cleaned = text.replace(/<\|.*?\|>/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.slice(0, 200);
  }
}
